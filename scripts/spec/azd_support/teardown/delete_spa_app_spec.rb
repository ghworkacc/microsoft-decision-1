$LOAD_PATH.unshift(File.expand_path("../../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Teardown::DeleteSpaApp do
  let(:client_id) { "client-123" }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("ENTRA_CLIENT_ID", nil).and_return(client_id)
    allow(ENV).to receive(:fetch).with("AZURE_ENV_NAME", nil).and_return("dev")
    allow(described_class).to receive(:sh)
  end

  context "when the app registration exists" do
    before { allow(described_class).to receive(:sh_capture).and_return("object-789") }

    it "deletes it and purges it from deleted items" do
      described_class.run

      expect(described_class).to have_received(:sh).with("az ad app delete --id client-123")
      expect(described_class).to have_received(:sh).with(
        "az rest --method DELETE --url https://graph.microsoft.com/v1.0/directory/deletedItems/object-789",
        allow_failure: true
      )
    end

    it "removes the identity deployment record" do
      described_class.run

      expect(described_class).to have_received(:sh).with(
        "az deployment sub delete --name poc-decide-something-identity-dev --no-wait",
        allow_failure: true
      )
    end
  end

  context "when the app registration is already gone" do
    before { allow(described_class).to receive(:sh_capture).and_return("") }

    it "does not try to delete it" do
      described_class.run

      expect(described_class).not_to have_received(:sh).with(/az ad app delete/)
    end
  end

  context "when ENTRA_CLIENT_ID is not set" do
    let(:client_id) { nil }

    it "does nothing" do
      expect(described_class).not_to receive(:sh_capture)

      described_class.run

      expect(described_class).not_to have_received(:sh)
    end
  end
end
