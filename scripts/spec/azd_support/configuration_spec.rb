$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Configuration do
  subject(:config) { described_class.new }

  describe "#[]" do
    it "returns nil for unknown keys" do
      expect(config["NONEXISTENT_KEY"]).to be_nil
    end

    it "returns the stored value when set" do
      config.set("STORAGE_ACCOUNT_NAME", "stfoo123")
      expect(config["STORAGE_ACCOUNT_NAME"]).to eq("stfoo123")
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
      config.set("STORAGE_ACCOUNT_NAME", "stbar456")
      expect(config.fetch("STORAGE_ACCOUNT_NAME")).to eq("stbar456")
    end

    it "raises KeyError when value is nil" do
      expect { config.fetch("STORAGE_ACCOUNT_NAME") }.to raise_error(KeyError, /STORAGE_ACCOUNT_NAME/)
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

    it "overlays stored values on top of defaults" do
      config.set("AZURE_ENV_NAME", "staging")
      config.set("STORAGE_ACCOUNT_NAME", "sttest")
      hash = config.to_env_hash
      expect(hash["AZURE_ENV_NAME"]).to eq("staging")
      expect(hash["STORAGE_ACCOUNT_NAME"]).to eq("sttest")
    end

    it "includes dynamically set keys not in KEYS registry" do
      config.set("DYNAMIC_VALUE", "hello")
      expect(config.to_env_hash["DYNAMIC_VALUE"]).to eq("hello")
    end
  end

  describe "#validate!" do
    it "does nothing when all keys are present" do
      config.set("STORAGE_ACCOUNT_NAME", "stfoo")
      config.set("AZURE_RESOURCE_GROUP", "rg-test")
      expect { config.validate!("STORAGE_ACCOUNT_NAME", "AZURE_RESOURCE_GROUP") }.not_to raise_error
    end

    it "aborts with missing keys listed" do
      config.set("STORAGE_ACCOUNT_NAME", "stfoo")
      expect {
        config.validate!("STORAGE_ACCOUNT_NAME", "AZURE_RESOURCE_GROUP")
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
        AZURE_RESOURCE_GROUP="rg-foo-dev"
        STORAGE_ACCOUNT_NAME="stfoo7x2k"
        AZURE_ENV_NAME="dev"
      SH
      allow(config).to receive(:_sh_capture).and_return(azd_output)
      config.load_azd!

      expect(config["AZURE_RESOURCE_GROUP"]).to eq("rg-foo-dev")
      expect(config["STORAGE_ACCOUNT_NAME"]).to eq("stfoo7x2k")
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
