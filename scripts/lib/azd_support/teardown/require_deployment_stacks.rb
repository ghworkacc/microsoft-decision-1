# Refuses to let `azd down` proceed unless the deployment.stacks alpha
# feature is on. Without stacks, azd's standard destroy deletes every resource
# group the deployment touched, which includes the shared Foundry resource
# group.
#
# Runs as the predown hook in azure.yaml.

module AzdSupport
  module Teardown
    module RequireDeploymentStacks
      extend AzdSupport::Helpers

      def self.run
        list_alpha = sh_capture("azd config list-alpha", allow_failure: true)

        if AzdSupport::Validation::LocalEnvironment.deployment_stacks_enabled?(list_alpha)
          log "azd alpha feature deployment.stacks is on — azd down will only delete the stack's resources."
          return
        end

        fail! "Refusing to run azd down: the azd alpha feature deployment.stacks is off, so azd would " \
              "delete whole resource groups (including the shared Foundry resource group). " \
              "Run: azd config set alpha.deployment.stacks on"
      end
    end
  end
end
