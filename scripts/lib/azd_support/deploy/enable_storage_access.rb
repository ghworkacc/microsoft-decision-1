# Enables public network access on a storage account so that `azd deploy`
# can upload deployment packages from outside the VNet.
#
# Runs as the predeploy hook in azure.yaml.

module AzdSupport
  module Deploy
    module EnableStorageAccess
      extend AzdSupport::Helpers

      def self.run
        rg = ENV.fetch("AZURE_RESOURCE_GROUP", nil)
        storage_account_name = ENV.fetch("STORAGE_ACCOUNT_NAME", nil)

        if blank?(rg) || blank?(storage_account_name)
          log "Skipping storage public-access patch — missing env vars (AZURE_RESOURCE_GROUP, STORAGE_ACCOUNT_NAME)"
          log "These are populated by azd after provisioning. If running manually, export them first."
          return
        end

        enable_public_access(rg, storage_account_name)
      end

      def self.enable_public_access(rg, sa)
        log "Enabling public network access on storage account #{sa}…"

        sh(
          "az storage account update " \
          "--name #{sa} " \
          "--resource-group #{rg} " \
          "--public-network-access Enabled " \
          "-o none"
        )

        log "Public network access enabled on #{sa}."
      end
      private_class_method :enable_public_access
    end
  end
end
