require "azd_support"

RSpec.describe AzCompare do
  RG = "rg-poc-decide-something-dev".freeze
  SUB = "/subscriptions/00000000-0000-0000-0000-000000000000".freeze

  def rg_id(type_and_name, resource_group: RG)
    "#{SUB}/resourceGroups/#{resource_group}/providers/#{type_and_name}"
  end

  def resource(id, type: nil, kind: nil)
    AzCompare::Resource.new(id: id, type: type, kind: kind)
  end

  def change(id, change_type, type: nil)
    AzCompare::Change.new(resource: resource(id, type: type), change_type: change_type)
  end

  let(:storage_id) { rg_id("Microsoft.Storage/storageAccounts/stabc123") }
  let(:blob_id)    { "#{storage_id}/blobServices/default" }

  describe AzCompare::Shell do
    let(:shell) { described_class.new }

    it "returns stdout for a successful command" do
      expect(shell.capture(["echo", "hello"])).to eq("hello\n")
    end

    it "parses JSON output" do
      expect(shell.capture_json(["echo", '{"a":1}'])).to eq({ "a" => 1 })
    end

    it "returns nil when the command produces no output" do
      expect(shell.capture_json(["true"])).to be_nil
    end

    it "raises CommandError on a non-zero exit" do
      expect { shell.capture(["false"]) }.to raise_error(AzCompare::CommandError, /exit 1/)
    end

    it "raises CommandError on unparseable JSON" do
      expect { shell.capture_json(["echo", "not json"]) }
        .to raise_error(AzCompare::CommandError, /could not parse JSON/)
    end

    it "passes the provided environment to the child process" do
      output = shell.capture(["sh", "-c", "printf %s \"$AZURE_ENV_NAME\""],
                             env: { "AZURE_ENV_NAME" => "dev" })
      expect(output).to eq("dev")
    end
  end

  describe AzCompare::Resource do
    it "derives the type from the resource ID when none is given" do
      expect(resource(storage_id).type).to eq("Microsoft.Storage/storageAccounts")
    end

    it "derives nested child types from the resource ID" do
      expect(resource(blob_id).type).to eq("Microsoft.Storage/storageAccounts/blobServices")
    end

    it "prefers an explicitly provided type" do
      expect(resource(storage_id, type: "Custom/type").type).to eq("Custom/type")
    end

    it "returns an empty type for an ID without a providers segment" do
      expect(resource("#{SUB}/resourceGroups/#{RG}").type).to eq("")
    end

    it "derives the name from the last ID segment" do
      expect(resource(storage_id).name).to eq("stabc123")
    end

    it "normalizes the ID to lowercase for comparison" do
      expect(resource(storage_id.upcase).normalized_id).to eq(storage_id.downcase)
    end

    it "extracts the resource group regardless of casing" do
      expect(resource(storage_id.upcase).resource_group).to eq(RG.upcase)
    end

    it "matches its resource group case-insensitively" do
      expect(resource(storage_id.upcase)).to be_in_resource_group(RG)
    end

    it "does not match a different resource group" do
      other = rg_id("Microsoft.Storage/storageAccounts/other", resource_group: "rg-other")
      expect(resource(other)).not_to be_in_resource_group(RG)
    end

    it "is not in a resource group when the ID is subscription scoped" do
      expect(resource("#{SUB}/providers/Microsoft.Authorization/roleAssignments/abc"))
        .not_to be_in_resource_group(RG)
    end

    it "shows the kind alongside the type when Azure reports one" do
      expect(resource(storage_id, kind: "StorageV2").display_kind)
        .to eq("StorageV2 (Microsoft.Storage/storageAccounts)")
    end

    it "falls back to the type when kind is nil" do
      expect(resource(storage_id).display_kind).to eq("Microsoft.Storage/storageAccounts")
    end

    it "falls back to the type when kind is blank" do
      expect(resource(storage_id, kind: "  ").display_kind).to eq("Microsoft.Storage/storageAccounts")
    end
  end

  describe AzCompare::ImplicitResources do
    it "flags auto-created child types" do
      expect(described_class).to be_implicit("Microsoft.Storage/storageAccounts/blobServices")
    end

    it "matches case-insensitively" do
      expect(described_class).to be_implicit("MICROSOFT.STORAGE/STORAGEACCOUNTS/BLOBSERVICES")
    end

    it "does not flag top-level types" do
      expect(described_class).not_to be_implicit("Microsoft.Storage/storageAccounts")
    end

    it "does not flag a nil type" do
      expect(described_class).not_to be_implicit(nil)
    end
  end

  describe AzCompare::Change do
    it "treats Create as not yet deployed" do
      expect(change(storage_id, "Create")).to be_missing
      expect(change(storage_id, "Create")).not_to be_deployed
    end

    %w[Modify NoChange NoEffect Ignore Deploy].each do |change_type|
      it "treats #{change_type} as already deployed" do
        expect(change(storage_id, change_type)).to be_deployed
        expect(change(storage_id, change_type)).not_to be_missing
      end
    end

    it "treats an unknown change type as neither deployed nor missing" do
      expect(change(storage_id, "Delete")).not_to be_deployed
      expect(change(storage_id, "Delete")).not_to be_missing
    end

    it "builds a resource from the after state" do
      built = described_class.from_json(
        "resourceId" => storage_id,
        "changeType" => "Modify",
        "after"      => { "type" => "Microsoft.Storage/storageAccounts", "kind" => "StorageV2" }
      )
      expect(built.resource.kind).to eq("StorageV2")
      expect(built).to be_deployed
    end

    it "falls back to the before state when after is absent" do
      built = described_class.from_json(
        "resourceId" => storage_id,
        "changeType" => "NoChange",
        "before"     => { "kind" => "StorageV2" }
      )
      expect(built.resource.kind).to eq("StorageV2")
    end

    it "tolerates a change with no before or after state" do
      built = described_class.from_json("resourceId" => storage_id, "changeType" => "Create")
      expect(built.resource.type).to eq("Microsoft.Storage/storageAccounts")
    end
  end

  describe AzCompare::WhatIf do
    let(:shell) { instance_double(AzCompare::Shell) }

    subject(:what_if) do
      described_class.new(
        resource_group:   RG,
        location:         "centralus",
        parameters_file:  "infra/main.bicepparam",
        environment_name: "dev",
        shell:            shell
      )
    end

    it "targets the subscription scope because main.bicep creates the resource group" do
      expect(what_if.argv.first(4)).to eq(%w[az deployment sub what-if])
    end

    it "passes the location and parameters file" do
      expect(what_if.argv).to include("--location", "centralus", "--parameters", "infra/main.bicepparam")
    end

    it "requests machine-readable output" do
      expect(what_if.argv).to include("--no-pretty-print")
    end

    it "omits --template-file because the bicepparam carries its own using statement" do
      expect(what_if.argv).not_to include("--template-file")
    end

    it "exports the variables main.bicepparam reads via readEnvironmentVariable" do
      expect(what_if.child_env).to eq("AZURE_ENV_NAME" => "dev", "AZURE_LOCATION" => "centralus")
    end

    it "returns the declared changes" do
      allow(shell).to receive(:capture_json).and_return(
        "changes" => [
          { "resourceId" => storage_id, "changeType" => "NoChange" },
        ]
      )
      expect(what_if.changes.map(&:change_type)).to eq(["NoChange"])
    end

    it "filters out changes belonging to another resource group" do
      allow(shell).to receive(:capture_json).and_return(
        "changes" => [
          { "resourceId" => storage_id, "changeType" => "Create" },
          { "resourceId" => rg_id("Microsoft.Storage/storageAccounts/x", resource_group: "rg-other"),
            "changeType" => "Create" },
        ]
      )
      expect(what_if.changes.map { |c| c.resource.id }).to eq([storage_id])
    end

    it "returns an empty list when the payload has no changes array" do
      allow(shell).to receive(:capture_json).and_return({})
      expect(what_if.changes).to be_empty
    end

    it "returns an empty list when the payload is nil" do
      allow(shell).to receive(:capture_json).and_return(nil)
      expect(what_if.changes).to be_empty
    end
  end

  describe AzCompare::Deployed do
    let(:shell) { instance_double(AzCompare::Shell) }

    subject(:deployed) { described_class.new(resource_group: RG, shell: shell) }

    it "scopes the listing to the resource group" do
      expect(deployed.argv).to include("--resource-group", RG)
    end

    it "maps the listing into resources" do
      allow(shell).to receive(:capture_json).and_return(
        [{ "id" => storage_id, "type" => "Microsoft.Storage/storageAccounts",
           "name" => "stabc123", "kind" => "StorageV2" }]
      )
      expect(deployed.resources.map(&:kind)).to eq(["StorageV2"])
    end

    it "reports nothing deployed when the resource group does not exist yet" do
      allow(shell).to receive(:capture_json)
        .and_raise(AzCompare::CommandError, "ResourceGroupNotFound")
      expect(deployed.resources).to be_empty
    end

    it "re-raises unrelated command failures" do
      allow(shell).to receive(:capture_json)
        .and_raise(AzCompare::CommandError, "AuthorizationFailed")
      expect { deployed.resources }.to raise_error(AzCompare::CommandError, /AuthorizationFailed/)
    end
  end

  describe AzCompare::Comparison do
    let(:orphan_id) { rg_id("Microsoft.Storage/storageAccounts/stleftover") }
    let(:missing_id) { rg_id("Microsoft.KeyVault/vaults/kvabc") }

    it "counts every declared resource" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange"), change(missing_id, "Create")],
        deployed: []
      )
      expect(comparison.defined_count).to eq(2)
    end

    it "counts only the declared resources that already exist" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange"), change(missing_id, "Create")],
        deployed: []
      )
      expect(comparison.deployed_count).to eq(1)
    end

    it "lists declared resources that are not deployed" do
      comparison = described_class.new(changes: [change(missing_id, "Create")], deployed: [])
      expect(comparison.missing.map(&:id)).to eq([missing_id])
    end

    it "lists deployed resources that are not declared" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange")],
        deployed: [resource(storage_id), resource(orphan_id)]
      )
      expect(comparison.excess.map(&:id)).to eq([orphan_id])
    end

    it "matches declared and deployed resources case-insensitively" do
      comparison = described_class.new(
        changes:  [change(storage_id.upcase, "NoChange")],
        deployed: [resource(storage_id)]
      )
      expect(comparison.excess).to be_empty
    end

    it "separates auto-created children from real excess" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange")],
        deployed: [resource(storage_id), resource(blob_id)]
      )
      expect(comparison.excess).to be_empty
      expect(comparison.implicit_excess.map(&:id)).to eq([blob_id])
    end

    it "reports drift when a declared resource is missing" do
      comparison = described_class.new(changes: [change(missing_id, "Create")], deployed: [])
      expect(comparison).to be_drift
    end

    it "reports drift when an undeclared resource exists" do
      comparison = described_class.new(changes: [], deployed: [resource(orphan_id)])
      expect(comparison).to be_drift
    end

    it "does not report drift when only implicit children are undeclared" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange")],
        deployed: [resource(storage_id), resource(blob_id)]
      )
      expect(comparison).not_to be_drift
    end

    it "does not report drift when everything matches" do
      comparison = described_class.new(
        changes:  [change(storage_id, "NoChange")],
        deployed: [resource(storage_id)]
      )
      expect(comparison).not_to be_drift
    end
  end

  describe AzCompare::Report do
    let(:io) { StringIO.new }
    let(:orphan_id) { rg_id("Microsoft.Storage/storageAccounts/stleftover") }

    def render(comparison)
      described_class.new(comparison: comparison, resource_group: RG, io: io).render
      io.string
    end

    it "prints the counts" do
      output = render(AzCompare::Comparison.new(changes: [change(storage_id, "NoChange")], deployed: []))
      expect(output).to include("Defined in bicep:      1")
      expect(output).to include("Deployed:              1")
    end

    it "prints the kind and full ID of excess resources" do
      output = render(
        AzCompare::Comparison.new(changes: [], deployed: [resource(orphan_id, kind: "StorageV2")])
      )
      expect(output).to include("StorageV2 (Microsoft.Storage/storageAccounts)")
      expect(output).to include(orphan_id)
    end

    it "lists implicit children in their own section" do
      output = render(
        AzCompare::Comparison.new(changes: [], deployed: [resource(blob_id)])
      )
      expect(output).to match(/Likely implicit\/child resources \(1\):\n\s+- Microsoft\.Storage/)
    end

    it "marks a clean comparison as in sync" do
      expect(render(AzCompare::Comparison.new(changes: [], deployed: []))).to include("Result: IN SYNC")
    end

    it "marks a drifting comparison as drifted" do
      output = render(AzCompare::Comparison.new(changes: [], deployed: [resource(orphan_id)]))
      expect(output).to include("Result: DRIFT DETECTED")
    end

    it "prints (none) for empty sections" do
      expect(render(AzCompare::Comparison.new(changes: [], deployed: []))).to include("(none)")
    end
  end

  describe AzCompare::CLI do
    let(:shell) { instance_double(AzCompare::Shell) }
    let(:io) { StringIO.new }
    let(:orphan_id) { rg_id("Microsoft.Storage/storageAccounts/stleftover") }

    def run(what_if_changes, deployed_resources)
      allow(shell).to receive(:capture_json) do |argv, **|
        argv.include?("what-if") ? { "changes" => what_if_changes } : deployed_resources
      end

      described_class.run(
        resource_group:   RG,
        location:         "centralus",
        environment_name: "dev",
        parameters_file:  "infra/main.bicepparam",
        shell:            shell,
        io:               io
      )
    end

    it "exits 0 when bicep and Azure agree" do
      code = run(
        [{ "resourceId" => storage_id, "changeType" => "NoChange" }],
        [{ "id" => storage_id }]
      )
      expect(code).to eq(described_class::EXIT_OK)
    end

    it "exits 1 when an undeclared resource exists in Azure" do
      code = run([], [{ "id" => orphan_id }])
      expect(code).to eq(described_class::EXIT_DRIFT)
    end

    it "exits 1 when a declared resource has not been deployed" do
      code = run([{ "resourceId" => storage_id, "changeType" => "Create" }], [])
      expect(code).to eq(described_class::EXIT_DRIFT)
    end

    it "writes the report to the provided IO" do
      run([], [])
      expect(io.string).to include("==> az_compare: #{RG}")
    end

    it "lets command errors propagate for the caller to map to an exit code" do
      allow(shell).to receive(:capture_json).and_raise(AzCompare::CommandError, "az login required")

      expect do
        described_class.run(
          resource_group:  RG,
          location:        "centralus",
          parameters_file: "infra/main.bicepparam",
          shell:           shell,
          io:              io
        )
      end.to raise_error(AzCompare::Error, /az login required/)
    end
  end
end
