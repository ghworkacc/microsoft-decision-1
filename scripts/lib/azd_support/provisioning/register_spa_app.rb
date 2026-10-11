require "json"
require "shellwords"

# Creates/updates the Entra ID app registration for the SPA by deploying
# infra/identity/app-registration.bicep, then stores its outputs
# (ENTRA_CLIENT_ID, AZURE_TENANT_ID) in the azd environment.
#
# This runs outside of azd's own provisioning because azd deploys
# infra/main.bicep as a deployment stack, and deployment stacks don't support
# the Microsoft Graph Bicep extension. A standard subscription deployment does.
#
# Runs as part of the postprovision hook in azure.yaml.

module AzdSupport
  module Provisioning
    module RegisterSpaApp
      extend AzdSupport::Helpers

      IDENTITY_DIR = File.join(AzdSupport::Helpers::REPO_ROOT, "infra", "identity")
      TEMPLATE_FILE = File.join(IDENTITY_DIR, "app-registration.bicep")
      PARAMETERS_FILE = File.join(IDENTITY_DIR, "app-registration.bicepparam")
      OUTPUT_KEYS = %w[ENTRA_CLIENT_ID AZURE_TENANT_ID].freeze

      def self.run
        env_name = ENV.fetch("AZURE_ENV_NAME", nil)
        location = ENV.fetch("AZURE_LOCATION", nil)

        if blank?(env_name) || blank?(location)
          fail! "AZURE_ENV_NAME and AZURE_LOCATION must be set (they are provided by azd)."
        end

        log "Deploying Entra app registration (#{File.basename(TEMPLATE_FILE)})…"

        raw = sh_capture(
          "az deployment sub create " \
          "--name #{Shellwords.escape(deployment_name(env_name))} " \
          "--location #{Shellwords.escape(location)} " \
          "--template-file #{Shellwords.escape(TEMPLATE_FILE)} " \
          "--parameters #{Shellwords.escape(PARAMETERS_FILE)} " \
          "--query properties.outputs -o json"
        )

        outputs = parse_outputs(raw)
        outputs.each do |key, value|
          sh("azd env set #{key} #{Shellwords.escape(value)}")
        end

        log "App registration ready (ENTRA_CLIENT_ID=#{outputs["ENTRA_CLIENT_ID"]})."
        outputs
      end

      def self.deployment_name(env_name)
        "poc-decide-something-identity-#{env_name}"[0, 64]
      end

      # The az CLI camel-cases output names (ENTRA_CLIENT_ID -> entrA_CLIENT_ID),
      # so match them case-insensitively.
      def self.parse_outputs(raw)
        outputs = JSON.parse(raw).transform_keys(&:upcase)
        OUTPUT_KEYS.to_h do |key|
          value = outputs.dig(key, "value")
          fail! "Deployment output #{key} is missing." if blank?(value)
          [key, value]
        end
      end
      private_class_method :parse_outputs
    end
  end
end
