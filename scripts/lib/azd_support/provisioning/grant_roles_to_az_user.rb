require "yaml"

# Grants the deploying user the Azure RBAC roles listed under
# deployer-role-assignments in azure.yaml.  Each entry specifies the role GUID
# and the env var that holds the target resource name, so nothing is hardcoded.
#
# Runs as part of the postprovision hook in azure.yaml.

module AzdSupport
  module Provisioning
    module GrantRolesToAzUser
      extend AzdSupport::Helpers

      TIMEOUT_SECONDS = 150
      POLL_INTERVAL_SECONDS = 5

      def self.run
        rg = ENV.fetch("AZURE_RESOURCE_GROUP", nil)

        if blank?(rg)
          log "Skipping RBAC grants — missing AZURE_RESOURCE_GROUP env var."
          return
        end

        assignments = load_role_assignments
        if assignments.nil? || assignments.empty?
          log "No deployer-role-assignments defined in azure.yaml — skipping RBAC grants."
          return
        end

        user_oid = get_user_oid
        return if user_oid.nil?

        new_assignments = []

        assignments.each do |role_name, config|
          role_id = config["role-id"]
          resource_env = config["resource-name-env"]
          resource_name = ENV.fetch(resource_env, nil)

          if blank?(resource_name)
            log "Skipping #{role_name} — env var #{resource_env} is not set."
            next
          end

          resource_scope = sh_capture(
            "az storage account show --name #{resource_name} --resource-group #{rg} --query id -o tsv"
          ).strip

          if assign_role(role_name, role_id, user_oid, resource_scope, resource_name)
            new_assignments << { resource_name: resource_name, role_name: role_name }
          end
        end

        new_assignments.each do |entry|
          wait_for_data_plane_access(entry[:resource_name], entry[:role_name])
        end
      end

      def self.load_role_assignments
        azure_yaml_path = File.join(AzdSupport::Helpers::REPO_ROOT, "azure.yaml")
        config = YAML.safe_load_file(azure_yaml_path)
        config.fetch("deployer-role-assignments", {})
      end
      private_class_method :load_role_assignments

      def self.get_user_oid
        user_oid = sh_capture("az ad signed-in-user show --query id -o tsv").strip
        if blank?(user_oid)
          log "Could not determine signed-in user OID — skipping RBAC grants."
          return
        end

        user_oid
      end
      private_class_method :get_user_oid

      def self.assign_role(role_name, role_id, user_oid, resource_scope, resource_name)
        # Check if assignment already exists
        existing = sh_capture(
          "az role assignment list --assignee #{user_oid} --scope #{resource_scope} " \
          "--role #{role_id} --query \"[0].id\" -o tsv",
          allow_failure: true
        )

        unless blank?(existing)
          log "Deploying user already has role #{role_name} (#{role_id}) on #{resource_name}."
          return
        end

        log "Granting role #{role_name} (#{role_id}) to deploying user on #{resource_name}..."

        sh(
          "az role assignment create " \
          "--assignee-object-id #{user_oid} " \
          "--assignee-principal-type User " \
          "--role #{role_id} " \
          "--scope #{resource_scope} " \
          "-o none"
        )

        log "Role assignment created."
        true
      end
      private_class_method :assign_role

      def self.wait_for_data_plane_access(resource_name, role_name)
        log "Waiting up to #{TIMEOUT_SECONDS}s for data-plane RBAC to propagate on #{resource_name} (#{role_name})\u2026"

        deadline = Time.now + TIMEOUT_SECONDS
        attempt = 0
        last_error = nil

        loop do
          attempt += 1
          ok, err = probe(resource_name)

          if ok
            log "RBAC propagated on #{resource_name} after #{attempt} attempt(s)."
            return
          end

          last_error = err
          remaining = deadline - Time.now
          if remaining <= 0
            $stderr.puts last_error.to_s unless blank?(last_error)
            fail! "Timed out after #{TIMEOUT_SECONDS}s waiting for data-plane RBAC " \
                  "to propagate on #{resource_name}. The deploying user may not have " \
                  "'#{role_name}' on the account."
          end

          sleep [POLL_INTERVAL_SECONDS, remaining].min
        end
      end
      private_class_method :wait_for_data_plane_access

      # Cheapest call that exercises the Blob data plane with AAD auth.
      # Returns [ok, error_output].
      def self.probe(account_name)
        _stdout, stderr, status = Open3.capture3(
          "az storage container list " \
          "--account-name #{account_name} " \
          "--auth-mode login " \
          "--num-results 1 " \
          "--query \"[0].name\" -o tsv"
        )
        [status.success?, stderr]
      end
      private_class_method :probe
    end
  end
end
