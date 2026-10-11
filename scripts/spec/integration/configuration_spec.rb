require "net/http"
require "uri"

$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

RSpec.describe "Configuration Integration", integration: true do
  subject(:config) { AzdSupport::Configuration.new }

  before { config.load_azd! }

  describe "#load_azd!" do
    it "populates ENTRA_CLIENT_ID from the live azd environment" do
      value = config["ENTRA_CLIENT_ID"]
      expect(value).to match(/\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/)
    end

    it "populates FOUNDRY_ENDPOINT as an https URL without a trailing slash" do
      value = config["FOUNDRY_ENDPOINT"]
      expect(value).to match(%r{\Ahttps://[^/]+\z})
    end

    it "populates DECISION_DEPLOYMENT_NAME" do
      expect(config["DECISION_DEPLOYMENT_NAME"]).not_to be_nil
    end

    it "records :azd in loaded_sources" do
      expect(config.loaded_sources).to include(:azd)
    end
  end
end
