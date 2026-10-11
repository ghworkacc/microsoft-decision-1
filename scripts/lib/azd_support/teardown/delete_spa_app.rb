require "shellwords"

# Deletes the Entra ID app registration created by
# Provisioning::RegisterSpaApp. `azd down` only removes what the deployment
# stack manages (the model deployment), so the app registration is cleaned up
# here.
#
# Runs as the postdown hook in azure.yaml.

module AzdSupport
  module Teardown
    module DeleteSpaApp
      extend AzdSupport::Helpers

      def self.run
        client_id = ENV.fetch("ENTRA_CLIENT_ID", nil)
        env_name = ENV.fetch("AZURE_ENV_NAME", nil)

        if blank?(client_id)
          log "Skipping app registration cleanup — ENTRA_CLIENT_ID is not set."
          return
        end

        object_id = sh_capture(
          "az ad app show --id #{Shellwords.escape(client_id)} --query id -o tsv",
          allow_failure: true
        )

        if blank?(object_id)
          log "App registration #{client_id} not found — nothing to delete."
        else
          log "Deleting app registration #{client_id}…"
          sh("az ad app delete --id #{Shellwords.escape(client_id)}")

          # Purge from the directory recycle bin so the uniqueName can be reused.
          sh(
            "az rest --method DELETE " \
            "--url https://graph.microsoft.com/v1.0/directory/deletedItems/#{Shellwords.escape(object_id)}",
            allow_failure: true
          )
        end

        return if blank?(env_name)

        sh(
          "az deployment sub delete --name " \
          "#{Shellwords.escape(AzdSupport::Provisioning::RegisterSpaApp.deployment_name(env_name))} " \
          "--no-wait",
          allow_failure: true
        )
      end
    end
  end
end
