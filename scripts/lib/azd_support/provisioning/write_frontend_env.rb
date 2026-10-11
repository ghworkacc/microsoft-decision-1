# Writes frontend/.env.local from frontend/.env.template using values from
# the azd environment, so `pnpm dev` / `pnpm build` pick up the Entra and
# Foundry settings produced by provisioning.
#
# Runs as part of the postprovision hook in azure.yaml.

module AzdSupport
  module Provisioning
    module WriteFrontendEnv
      extend AzdSupport::Helpers
      extend AzdSupport::TemplateHelpers

      FRONTEND_DIR = File.join(AzdSupport::Helpers::REPO_ROOT, "frontend")
      TEMPLATE_FILE = File.join(FRONTEND_DIR, ".env.template")
      OUTPUT_FILE = File.join(FRONTEND_DIR, ".env.local")

      def self.run(config: nil, template: TEMPLATE_FILE, output: OUTPUT_FILE)
        if config.nil?
          # Load fresh values: earlier postprovision steps may have run `azd env set`.
          config = AzdSupport::Configuration.new
          config.load_azd!
        end

        require_template_vars(template, config: config)
        expand_template(template, output, config: config)
        log "Wrote #{output}"
      end
    end
  end
end
