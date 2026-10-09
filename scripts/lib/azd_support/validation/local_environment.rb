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

        # ── result ───────────────────────────────────────────────────────
        puts ""
        if errors > 0
          $stderr.puts "Pre-flight failed — #{errors} problem(s) found.  Fix the issues above and retry."
          exit 1
        end

        puts "All checks passed."
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
