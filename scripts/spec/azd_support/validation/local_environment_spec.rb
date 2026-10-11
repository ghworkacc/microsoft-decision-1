$LOAD_PATH.unshift(File.expand_path("../../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Validation::LocalEnvironment do
  describe ".deployment_stacks_enabled?" do
    def list_alpha(status)
      <<~OUT
        Name: aks.helm
        Description: Enable Helm support for AKS deployments.
        Status: On

        Name: deployment.stacks
        Description: Enables Azure deployment stacks for ARM/Bicep based deployments.
        Status: #{status}

        Name: language.custom
        Description: Enables support for services to use custom language.
        Status: On
      OUT
    end

    it "is true when the feature status is On" do
      expect(described_class.deployment_stacks_enabled?(list_alpha("On"))).to be(true)
    end

    it "is false when the feature status is Off, even if other features are On" do
      expect(described_class.deployment_stacks_enabled?(list_alpha("Off"))).to be(false)
    end

    it "is false when the feature is not listed" do
      expect(described_class.deployment_stacks_enabled?("")).to be(false)
    end
  end
end
