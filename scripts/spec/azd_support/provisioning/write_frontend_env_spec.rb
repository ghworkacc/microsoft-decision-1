require "tempfile"

$LOAD_PATH.unshift(File.expand_path("../../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Provisioning::WriteFrontendEnv do
  let(:config) do
    c = AzdSupport::Configuration.new
    c.set("ENTRA_CLIENT_ID", "client-123")
    c.set("AZURE_TENANT_ID", "tenant-456")
    c.set("FOUNDRY_ENDPOINT", "https://the-new-foundry.services.ai.azure.com")
    c.set("DECISION_DEPLOYMENT_NAME", "msft-decision-1")
    c
  end

  let(:output) { Tempfile.new([".env", ".local"]).tap(&:close) }

  after { output.unlink }

  it "expands the real frontend/.env.template into the output file" do
    described_class.run(config: config, output: output.path)

    expect(File.read(output.path)).to include(
      "VITE_ENTRA_CLIENT_ID=client-123",
      "VITE_ENTRA_TENANT_ID=tenant-456",
      "VITE_FOUNDRY_ENDPOINT=https://the-new-foundry.services.ai.azure.com",
      "VITE_DECISION_DEPLOYMENT=msft-decision-1"
    )
  end

  it "aborts when a value the template needs is missing" do
    sparse = AzdSupport::Configuration.new
    sparse.set("ENTRA_CLIENT_ID", "client-123")

    expect { described_class.run(config: sparse, output: output.path) }.to raise_error(SystemExit)
  end

  it "loads the azd environment when no config is given" do
    allow_any_instance_of(AzdSupport::Configuration).to receive(:_sh_capture).and_return(<<~SH)
      ENTRA_CLIENT_ID="from-azd"
      AZURE_TENANT_ID="tenant"
      FOUNDRY_ENDPOINT="https://foundry.example"
      DECISION_DEPLOYMENT_NAME="dep"
    SH

    described_class.run(output: output.path)

    expect(File.read(output.path)).to include("VITE_ENTRA_CLIENT_ID=from-azd")
  end
end
