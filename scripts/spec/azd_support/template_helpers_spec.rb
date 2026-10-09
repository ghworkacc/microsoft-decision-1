require "tempfile"
require "fileutils"

$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::TemplateHelpers do
  include described_class

  let(:config) do
    c = AzdSupport::Configuration.new
    c.set("APP_NAME", "my-app")
    c.set("STORAGE_ACCOUNT_NAME", "stfoo123")
    c.set("AZURE_ENV_NAME", "prod")
    c
  end

  describe "#extract_template_vars" do
    it "finds all unique ${VAR} references in a file" do
      file = Tempfile.new(["tpl", ".yaml"])
      file.write("name: ${APP_NAME}\nsa: ${STORAGE_ACCOUNT_NAME}\nenv: ${APP_NAME}\n")
      file.close

      vars = extract_template_vars(file.path)
      expect(vars).to contain_exactly("APP_NAME", "STORAGE_ACCOUNT_NAME")
    ensure
      file&.unlink
    end

    it "returns empty array when no vars present" do
      file = Tempfile.new(["tpl", ".yaml"])
      file.write("plain: text\n")
      file.close

      expect(extract_template_vars(file.path)).to eq([])
    ensure
      file&.unlink
    end
  end

  describe "#expand_template" do
    it "replaces ${VAR} references with config values" do
      src = Tempfile.new(["src", ".yaml"])
      src.write("app: ${APP_NAME}\nenv: ${AZURE_ENV_NAME}\n")
      src.close

      dest = Tempfile.new(["dest", ".yaml"])
      dest.close

      expand_template(src.path, dest.path, config: config)
      result = File.read(dest.path)

      expect(result).to eq("app: my-app\nenv: prod\n")
    ensure
      src&.unlink
      dest&.unlink
    end

    it "replaces unknown vars with empty string" do
      src = Tempfile.new(["src", ".yaml"])
      src.write("val: ${UNKNOWN_VAR}\n")
      src.close

      dest = Tempfile.new(["dest", ".yaml"])
      dest.close

      expand_template(src.path, dest.path, config: config)
      expect(File.read(dest.path)).to eq("val: \n")
    ensure
      src&.unlink
      dest&.unlink
    end

    it "preserves text outside of variable references" do
      src = Tempfile.new(["src", ".txt"])
      src.write("Hello ${APP_NAME}, your account is ${STORAGE_ACCOUNT_NAME}!")
      src.close

      dest = Tempfile.new(["dest", ".txt"])
      dest.close

      expand_template(src.path, dest.path, config: config)
      expect(File.read(dest.path)).to eq("Hello my-app, your account is stfoo123!")
    ensure
      src&.unlink
      dest&.unlink
    end
  end

  describe "#require_template_vars" do
    it "passes when all vars are present in config" do
      file = Tempfile.new(["tpl", ".yaml"])
      file.write("app: ${APP_NAME}\nsa: ${STORAGE_ACCOUNT_NAME}\n")
      file.close

      expect { require_template_vars(file.path, config: config) }.not_to raise_error
    ensure
      file&.unlink
    end

    it "passes for vars with a registered default even if not explicitly set" do
      sparse_config = AzdSupport::Configuration.new
      sparse_config.set("APP_NAME", "test")
      # AZURE_ENV_NAME has default "dev" — not explicitly set but should pass

      file = Tempfile.new(["tpl", ".yaml"])
      file.write("app: ${APP_NAME}\nenv: ${AZURE_ENV_NAME}\n")
      file.close

      expect { require_template_vars(file.path, config: sparse_config) }.not_to raise_error
    ensure
      file&.unlink
    end

    it "aborts when a required var is missing" do
      empty_config = AzdSupport::Configuration.new

      file = Tempfile.new(["tpl", ".yaml"])
      file.write("sa: ${STORAGE_ACCOUNT_NAME}\n")
      file.close

      expect {
        require_template_vars(file.path, config: empty_config)
      }.to raise_error(SystemExit)
    ensure
      file&.unlink
    end
  end

  describe "#find_templates" do
    it "returns matching files sorted" do
      dir = Dir.mktmpdir
      FileUtils.touch(File.join(dir, "b.template.yaml"))
      FileUtils.touch(File.join(dir, "a.template.yaml"))
      FileUtils.touch(File.join(dir, "c.txt"))

      results = find_templates(dir, "*.template.yaml")
      expect(results.map { |f| File.basename(f) }).to eq(["a.template.yaml", "b.template.yaml"])
    ensure
      FileUtils.rm_rf(dir) if dir
    end
  end
end
