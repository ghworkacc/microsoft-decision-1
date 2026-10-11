# Pre-flight check that runs before `azd up` / `azd provision` (via the
# preprovision hook in azure.yaml). Validates that every CLI tool and
# configuration setting required by the deployment pipeline is present.

module AzdSupport
  module Validation
    module LocalEnvironment
      extend AzdSupport::Helpers

      def self.run(_config = nil)
        errors = 0
        ci_mode = ENV["CI"] || ENV["GITHUB_ACTIONS"]

        puts ""
        puts "Checking required tools …"

        tools = {
          "ruby" => "https://www.ruby-lang.org/en/documentation/installation/",
          "az"   => "https://learn.microsoft.com/cli/azure/install-azure-cli",
          "azd"  => "https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd",
          "node" => "https://nodejs.org/en/download",
          "pnpm" => "https://pnpm.io/installation",
        }

        tools.each do |name, url|
          if tool_exists?(name)
            path = sh_capture("which #{name}", allow_failure: true)
            errors += check_ok("#{name} found (#{path})")
          else
            errors += check_fail("#{name} is not installed.  Install: #{url}")
          end
        end

        # ── authentication status ────────────────────────────────────────
        puts ""
        puts "Checking authentication …"

        if tool_exists?("az")
          if system("az account show >/dev/null 2>&1")
            account = sh_capture("az account show --query name -o tsv 2>/dev/null", allow_failure: true)
            errors += check_ok("az logged in (subscription: #{account})")
          elsif ci_mode
            errors += check_ok("az login deferred to CI workflow")
          else
            errors += check_fail("az is not logged in.  Run: az login")
          end
        end

        if tool_exists?("azd")
          if system("azd auth login --check-status >/dev/null 2>&1")
            errors += check_ok("azd authenticated")
          elsif ci_mode
            errors += check_ok("azd auth deferred to CI workflow")
          else
            errors += check_fail("azd is not authenticated.  Run: azd auth login")
          end
        end

        # ── azd alpha features ───────────────────────────────────────────
        # azure.yaml relies on deployment stacks so that `azd down` only
        # deletes the model deployment, never the shared Foundry resource group.
        if tool_exists?("azd")
          puts ""
          puts "Checking azd alpha features …"

          alpha = sh_capture("azd config list-alpha", allow_failure: true)
          if deployment_stacks_enabled?(alpha)
            errors += check_ok("azd alpha feature deployment.stacks is on")
          else
            errors += check_fail("azd alpha feature deployment.stacks is off.  " \
                                 "Run: azd config set alpha.deployment.stacks on")
          end
        end

        # ── result ───────────────────────────────────────────────────────
        puts ""
        if errors > 0
          $stderr.puts "Pre-flight failed — #{errors} problem(s) found.  Fix the issues above and retry."
          exit 1
        end

        puts "All checks passed."
      end

      # Parses `azd config list-alpha` output, which lists blocks like:
      #   Name: deployment.stacks
      #   Description: ...
      #   Status: On
      def self.deployment_stacks_enabled?(list_alpha_output)
        block = list_alpha_output.to_s.split(/\n\s*\n/).find do |b|
          b.match?(/^Name:\s*deployment\.stacks\s*$/)
        end
        !block.nil? && block.match?(/^Status:\s*On\s*$/i)
      end

      # ── private helpers ──────────────────────────────────────────────

      def self.check_fail(msg)
        $stderr.puts "  ✗ #{msg}"
        1
      end
      private_class_method :check_fail

      def self.check_ok(msg)
        puts "  ✓ #{msg}"
        0
      end
      private_class_method :check_ok
    end
  end
end
