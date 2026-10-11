require "json"

$LOAD_PATH.unshift(File.expand_path("../../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Provisioning::RegisterSpaApp do
  # Key casing as returned by the az CLI, which camel-cases output names.
  let(:outputs_json) do
    {
      "entrA_CLIENT_ID" => { "type" => "String", "value" => "client-123" },
      "azurE_TENANT_ID" => { "type" => "String", "value" => "tenant-456" },
    }.to_json
  end

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("AZURE_ENV_NAME", nil).and_return("dev")
    allow(ENV).to receive(:fetch).with("AZURE_LOCATION", nil).and_return("eastus2")
    allow(described_class).to receive(:sh)
  end

  it "deploys the identity template at subscription scope" do
    expect(described_class).to receive(:sh_capture) do |cmd|
      expect(cmd).to start_with("az deployment sub create ")
      expect(cmd).to include("--name poc-decide-something-identity-dev")
      expect(cmd).to include("--location eastus2")
      expect(cmd).to match(%r{--template-file \S+/infra/identity/app-registration\.bicep})
      expect(cmd).to match(%r{--parameters \S+/infra/identity/app-registration\.bicepparam})
      outputs_json
    end

    described_class.run
  end

  it "stores the outputs in the azd environment" do
    allow(described_class).to receive(:sh_capture).and_return(outputs_json)

    expect(described_class.run).to eq(
      "ENTRA_CLIENT_ID" => "client-123",
      "AZURE_TENANT_ID" => "tenant-456"
    )
    expect(described_class).to have_received(:sh).with("azd env set ENTRA_CLIENT_ID client-123")
    expect(described_class).to have_received(:sh).with("azd env set AZURE_TENANT_ID tenant-456")
  end

  it "aborts when an output is missing" do
    allow(described_class).to receive(:sh_capture).and_return({ "AZURE_TENANT_ID" => { "value" => "t" } }.to_json)

    expect { described_class.run }.to raise_error(SystemExit)
  end

  it "aborts when azd values are missing" do
    allow(ENV).to receive(:fetch).with("AZURE_LOCATION", nil).and_return(nil)

    expect { described_class.run }.to raise_error(SystemExit)
  end

  describe ".deployment_name" do
    it "caps the name at 64 characters" do
      expect(described_class.deployment_name("x" * 80).length).to eq(64)
    end
  end
end
