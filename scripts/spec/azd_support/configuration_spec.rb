$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Configuration do
  subject(:config) { described_class.new }

  describe "#[]" do
    it "returns nil for unknown keys" do
      expect(config["NONEXISTENT_KEY"]).to be_nil
    end

    it "returns the stored value when set" do
      config.set("DECISION_DEPLOYMENT_NAME", "msft-decision-1")
      expect(config["DECISION_DEPLOYMENT_NAME"]).to eq("msft-decision-1")
    end

    it "returns the registered default when no value is stored" do
      expect(config["AZURE_ENV_NAME"]).to eq("dev")
    end

    it "prefers stored value over default" do
      config.set("AZURE_ENV_NAME", "prod")
      expect(config["AZURE_ENV_NAME"]).to eq("prod")
    end

    context "with fallback keys" do
      before do
        # Temporarily add a key with a fallback for testing
        stub_const("AzdSupport::Configuration::KEYS", {
          "PRIMARY" => { source: :azd, fallbacks: %w[FALLBACK_A FALLBACK_B] },
          "FALLBACK_A" => { source: :azd },
          "FALLBACK_B" => { source: :azd },
        })
      end

      it "returns nil when no fallback is set either" do
        expect(config["PRIMARY"]).to be_nil
      end

      it "resolves the first available fallback" do
        config.set("FALLBACK_B", "from_b")
        expect(config["PRIMARY"]).to eq("from_b")
      end

      it "prefers earlier fallbacks" do
        config.set("FALLBACK_A", "from_a")
        config.set("FALLBACK_B", "from_b")
        expect(config["PRIMARY"]).to eq("from_a")
      end
    end
  end

  describe "#fetch" do
    it "returns the value when present" do
      config.set("ENTRA_CLIENT_ID", "00000000-0000-0000-0000-000000000001")
      expect(config.fetch("ENTRA_CLIENT_ID")).to eq("00000000-0000-0000-0000-000000000001")
    end

    it "raises KeyError when value is nil" do
      expect { config.fetch("ENTRA_CLIENT_ID") }.to raise_error(KeyError, /ENTRA_CLIENT_ID/)
    end
  end

  describe "#set" do
    it "stores a value retrievable via #[]" do
      config.set("CUSTOM_KEY", "custom_val")
      expect(config["CUSTOM_KEY"]).to eq("custom_val")
    end
  end

  describe "#to_env_hash" do
    it "includes registered defaults" do
      hash = config.to_env_hash
      expect(hash["AZURE_ENV_NAME"]).to eq("dev")
    end

    it "defaults anonymous mode off with the documented limits" do
      hash = config.to_env_hash
      expect(hash["ANONYMOUS_MODE"]).to eq("false")
      expect(hash["DECISION_PROXY_URL"]).to eq("")
      expect(hash["ANONYMOUS_CORS_ORIGINS"]).to eq("https://ghworkacc.github.io,http://localhost:5173")
      expect(hash["ANONYMOUS_RATE_LIMIT_PER_MINUTE"]).to eq("5")
    end

    it "overlays stored values on top of defaults" do
      config.set("AZURE_ENV_NAME", "staging")
      config.set("DECISION_DEPLOYMENT_NAME", "msft-decision-1")
      hash = config.to_env_hash
      expect(hash["AZURE_ENV_NAME"]).to eq("staging")
      expect(hash["DECISION_DEPLOYMENT_NAME"]).to eq("msft-decision-1")
    end

    it "includes dynamically set keys not in KEYS registry" do
      config.set("DYNAMIC_VALUE", "hello")
      expect(config.to_env_hash["DYNAMIC_VALUE"]).to eq("hello")
    end
  end

  describe "#validate!" do
    it "does nothing when all keys are present" do
      config.set("FOUNDRY_ENDPOINT", "https://foundry.example")
      config.set("ENTRA_CLIENT_ID", "client-id")
      expect { config.validate!("FOUNDRY_ENDPOINT", "ENTRA_CLIENT_ID") }.not_to raise_error
    end

    it "aborts with missing keys listed" do
      config.set("FOUNDRY_ENDPOINT", "https://foundry.example")
      expect {
        config.validate!("FOUNDRY_ENDPOINT", "ENTRA_CLIENT_ID")
      }.to raise_error(SystemExit)
    end
  end

  describe "#loaded_sources" do
    it "starts empty" do
      expect(config.loaded_sources).to eq([])
    end

    it "records :azd after load_azd!" do
      allow(config).to receive(:_sh_capture).and_return("")
      config.load_azd!
      expect(config.loaded_sources).to include(:azd)
    end

    it "records :env after load_env!" do
      config.load_env!
      expect(config.loaded_sources).to include(:env)
    end
  end

  describe "#load_azd!" do
    it "parses KEY=VALUE lines from azd output" do
      azd_output = <<~SH
        FOUNDRY_ENDPOINT="https://the-new-foundry.services.ai.azure.com"
        DECISION_DEPLOYMENT_NAME="msft-decision-1"
        AZURE_ENV_NAME="dev"
      SH
      allow(config).to receive(:_sh_capture).and_return(azd_output)
      config.load_azd!

      expect(config["FOUNDRY_ENDPOINT"]).to eq("https://the-new-foundry.services.ai.azure.com")
      expect(config["DECISION_DEPLOYMENT_NAME"]).to eq("msft-decision-1")
    end

    it "handles single-quoted values" do
      allow(config).to receive(:_sh_capture).and_return("FOO='bar baz'\n")
      config.load_azd!
      expect(config["FOO"]).to eq("bar baz")
    end

    it "handles unquoted values" do
      allow(config).to receive(:_sh_capture).and_return("FOO=simple\n")
      config.load_azd!
      expect(config["FOO"]).to eq("simple")
    end

    it "skips comment lines and blank lines" do
      raw = "# comment\n\nFOO=\"val\"\n"
      allow(config).to receive(:_sh_capture).and_return(raw)
      config.load_azd!
      expect(config["FOO"]).to eq("val")
    end

    it "strips export prefix" do
      allow(config).to receive(:_sh_capture).and_return("export KEY=\"value\"\n")
      config.load_azd!
      expect(config["KEY"]).to eq("value")
    end

    it "writes missing registered defaults to azd without overwriting values" do
      allow(config).to receive(:_sh_capture).and_return(
        "ANONYMOUS_MODE=\"true\"\n",
        ""
      )

      config.ensure_azd_defaults!

      expect(config["ANONYMOUS_MODE"]).to eq("true")
      expect(config["DECISION_CAPACITY"]).to eq("10")
      expect(config).to have_received(:_sh_capture).with(
        "azd env set DECISION_CAPACITY 10"
      )
      expect(config).not_to have_received(:_sh_capture).with(
        "azd env set ANONYMOUS_MODE false"
      )
    end
  end

  describe "#load_env!" do
    it "reads SOME_APP_SECRET from ENV" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("SOME_APP_SECRET").and_return("s3cret")
      config.load_env!
      expect(config["SOME_APP_SECRET"]).to eq("s3cret")
    end

    it "skips empty env values" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("SOME_APP_SECRET").and_return("")
      config.load_env!
      expect(config["SOME_APP_SECRET"]).to be_nil
    end
  end

  describe "#load_shell_exports!" do
    it "merges arbitrary KEY=VALUE pairs into the store" do
      config.load_shell_exports!("A=\"1\"\nB=\"2\"\n")
      expect(config["A"]).to eq("1")
      expect(config["B"]).to eq("2")
    end
  end
end
