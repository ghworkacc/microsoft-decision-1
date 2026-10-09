require "net/http"
require "uri"

$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

RSpec.describe "Configuration Integration", integration: true do
  subject(:config) { AzdSupport::Configuration.new }

  before { config.load_azd! }

  describe "#load_azd!" do
    it "populates STORAGE_ACCOUNT_NAME from the live azd environment" do
      value = config["STORAGE_ACCOUNT_NAME"]
      expect(value).not_to be_nil
      expect(value).not_to be_empty
    end

    it "populates AZURE_RESOURCE_GROUP matching the expected naming pattern" do
      value = config["AZURE_RESOURCE_GROUP"]
      expect(value).to match(/\Arg-/)
    end

    it "records :azd in loaded_sources" do
      expect(config.loaded_sources).to include(:azd)
    end
  end
end
