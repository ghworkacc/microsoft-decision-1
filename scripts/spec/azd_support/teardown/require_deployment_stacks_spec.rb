$LOAD_PATH.unshift(File.expand_path("../../../lib", __dir__))
require "azd_support"

RSpec.describe AzdSupport::Teardown::RequireDeploymentStacks do
  def list_alpha(status)
    "Name: deployment.stacks\nDescription: Enables Azure deployment stacks.\nStatus: #{status}\n"
  end

  it "passes when deployment stacks are on" do
    allow(described_class).to receive(:sh_capture).and_return(list_alpha("On"))

    expect { described_class.run }.not_to raise_error
  end

  it "aborts azd down when deployment stacks are off" do
    allow(described_class).to receive(:sh_capture).and_return(list_alpha("Off"))

    expect { described_class.run }.to raise_error(SystemExit)
  end

  it "aborts azd down when the alpha list can't be read" do
    allow(described_class).to receive(:sh_capture).and_return("")

    expect { described_class.run }.to raise_error(SystemExit)
  end
end
