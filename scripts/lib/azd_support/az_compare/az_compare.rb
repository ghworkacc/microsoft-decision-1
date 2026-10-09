require "json"
require "open3"
require "set"

# AzCompare reports drift between the resources declared in a Bicep template
# and the resources actually deployed into an Azure resource group.
#
# This namespace is intentionally self-contained: it has its own shell wrapper,
# its own error types and its own reporting, and it depends on nothing from
# AzdSupport. That keeps it trivial to extract into a standalone gem later.
#
# Usage:
#   exit AzCompare::CLI.run(
#     resource_group:   "rg-poc-decide-something-dev",
#     location:         "centralus",
#     environment_name: "dev",
#     parameters_file:  "infra/main.bicepparam"
#   )
#
module AzCompare
  # Base error for every failure raised by this library.
  class Error < StandardError; end

  # Raised when a shelled-out command fails or returns unparseable output.
  class CommandError < Error; end

  # ------------------------------------------------------------------
  # Shell
  # ------------------------------------------------------------------

  # Minimal command runner. Injected everywhere so specs never touch Azure.
  #
  # Commands are passed as an argv array (never a string) so arguments are
  # handed to the OS directly and are not interpreted by a shell.
  class Shell
    # Run a command and return its stdout. Raises CommandError on failure.
    def capture(argv, env: {})
      stdout, stderr, status = Open3.capture3(env, *argv)
      unless status.success?
        raise CommandError,
              "command failed (exit #{status.exitstatus}): #{argv.join(" ")}\n#{stderr.strip}"
      end
      stdout
    end

    # Run a command and parse its stdout as JSON.
    def capture_json(argv, env: {})
      raw = capture(argv, env: env)
      return nil if raw.strip.empty?

      JSON.parse(raw)
    rescue JSON::ParserError => e
      raise CommandError, "could not parse JSON from `#{argv.join(" ")}`: #{e.message}"
    end
  end

  # ------------------------------------------------------------------
  # Resource
  # ------------------------------------------------------------------

  # A single Azure resource, identified by its fully qualified resource ID.
  class Resource
    attr_reader :id, :type, :name, :kind

    def initialize(id:, type: nil, name: nil, kind: nil)
      @id   = id.to_s
      @type = blank?(type) ? self.class.type_from_id(@id) : type.to_s
      @name = blank?(name) ? @id.split("/").last.to_s : name.to_s
      @kind = blank?(kind) ? nil : kind.to_s
    end

    # Azure resource IDs are case-insensitive, so all set comparisons are
    # done against the normalized form.
    def normalized_id
      @id.downcase
    end

    # The resource group segment of the ID, or nil for non-RG-scoped resources.
    def resource_group
      match = @id.match(%r{/resourceGroups/([^/]+)}i)
      match && match[1]
    end

    def in_resource_group?(resource_group_name)
      rg = resource_group
      return false if rg.nil?

      rg.casecmp?(resource_group_name.to_s)
    end

    def implicit?
      ImplicitResources.implicit?(@type)
    end

    # Human-readable label: the kind when Azure reports one, else the type.
    def display_kind
      @kind.nil? ? @type : "#{@kind} (#{@type})"
    end

    # Derive "Microsoft.Storage/storageAccounts/blobServices" from a full ID.
    def self.type_from_id(id)
      marker = "/providers/"
      index  = id.to_s.downcase.rindex(marker)
      return "" if index.nil?

      segments = id[(index + marker.length)..].to_s.split("/")
      return "" if segments.empty?

      namespace = segments.shift
      # Remaining segments alternate type/name, so keep every other one.
      ([namespace] + segments.each_slice(2).map(&:first)).join("/")
    end

    private

    def blank?(value)
      value.nil? || value.to_s.strip.empty?
    end
  end

  # ------------------------------------------------------------------
  # Implicit resources
  # ------------------------------------------------------------------

  # Child resources Azure creates automatically. They show up in
  # `az resource list` but are never declared in Bicep, so reporting them as
  # excess would be noise. They are listed separately and do not count as drift.
  module ImplicitResources
    TYPES = [
      "Microsoft.Storage/storageAccounts/blobServices",
      "Microsoft.Storage/storageAccounts/fileServices",
      "Microsoft.Storage/storageAccounts/queueServices",
      "Microsoft.Storage/storageAccounts/tableServices",
      "Microsoft.Web/sites/config",
      "Microsoft.Web/sites/hostNameBindings",
      "Microsoft.Insights/diagnosticsSettings",
      "Microsoft.OperationalInsights/workspaces/tables",
      "microsoft.alertsmanagement/smartDetectorAlertRules",
    ].freeze

    NORMALIZED = TYPES.map(&:downcase).freeze

    def self.implicit?(type)
      NORMALIZED.include?(type.to_s.downcase)
    end
  end

  # ------------------------------------------------------------------
  # Change
  # ------------------------------------------------------------------

  # One entry from the what-if `changes` array: a declared resource plus the
  # change Azure predicts for it.
  class Change
    # Azure resolved the resource and it already exists.
    DEPLOYED_TYPES = %w[modify nochange noeffect ignore deploy].freeze

    # The resource is declared in Bicep but does not exist yet.
    MISSING_TYPES = %w[create].freeze

    attr_reader :resource, :change_type

    def initialize(resource:, change_type:)
      @resource    = resource
      @change_type = change_type.to_s
    end

    def deployed?
      DEPLOYED_TYPES.include?(@change_type.downcase)
    end

    def missing?
      MISSING_TYPES.include?(@change_type.downcase)
    end

    # Build from a raw what-if change hash.
    def self.from_json(hash)
      state = hash["after"] || hash["before"] || {}
      state = {} unless state.is_a?(Hash)

      new(
        resource: Resource.new(
          id:   hash["resourceId"],
          type: state["type"],
          name: state["name"],
          kind: state["kind"]
        ),
        change_type: hash["changeType"]
      )
    end
  end

  # ------------------------------------------------------------------
  # WhatIf
  # ------------------------------------------------------------------

  # Asks Azure what the Bicep template declares.
  #
  # `infra/main.bicep` is subscription-scoped (it creates the resource group),
  # so this uses `az deployment sub what-if`. The .bicepparam file carries its
  # own `using` statement, so `--template-file` must NOT be passed alongside it.
  class WhatIf
    def initialize(resource_group:, location:, parameters_file:, environment_name: nil, shell: Shell.new)
      @resource_group   = resource_group
      @location         = location
      @parameters_file  = parameters_file
      @environment_name = environment_name
      @shell            = shell
    end

    # Declared resources scoped to this project's resource group.
    def changes
      payload = @shell.capture_json(argv, env: child_env)
      raw     = payload.is_a?(Hash) ? payload["changes"] : nil
      return [] unless raw.is_a?(Array)

      raw.map { |hash| Change.from_json(hash) }
         .select { |change| change.resource.in_resource_group?(@resource_group) }
    end

    def argv
      [
        "az", "deployment", "sub", "what-if",
        "--location", @location.to_s,
        "--parameters", @parameters_file.to_s,
        "--no-pretty-print",
        "--only-show-errors",
        "-o", "json",
      ]
    end

    # main.bicepparam resolves these through readEnvironmentVariable(), so they
    # must be present in the child process environment.
    def child_env
      env = {}
      env["AZURE_ENV_NAME"] = @environment_name.to_s unless @environment_name.nil?
      env["AZURE_LOCATION"] = @location.to_s unless @location.nil?
      env
    end
  end

  # ------------------------------------------------------------------
  # Deployed
  # ------------------------------------------------------------------

  # Lists what actually exists in the resource group right now.
  class Deployed
    MISSING_GROUP_PATTERN = /ResourceGroupNotFound|could not be found/i

    def initialize(resource_group:, shell: Shell.new)
      @resource_group = resource_group
      @shell          = shell
    end

    def resources
      payload = @shell.capture_json(argv)
      return [] unless payload.is_a?(Array)

      payload.map do |hash|
        Resource.new(id: hash["id"], type: hash["type"], name: hash["name"], kind: hash["kind"])
      end
    rescue CommandError => e
      # A resource group that does not exist yet simply means nothing is
      # deployed; every declared resource will be reported as missing.
      raise unless e.message.match?(MISSING_GROUP_PATTERN)

      []
    end

    def argv
      [
        "az", "resource", "list",
        "--resource-group", @resource_group.to_s,
        "--only-show-errors",
        "-o", "json",
      ]
    end
  end

  # ------------------------------------------------------------------
  # Comparison
  # ------------------------------------------------------------------

  # Pure reconciliation logic. Does no I/O, so it is directly unit testable.
  class Comparison
    attr_reader :changes, :deployed

    def initialize(changes:, deployed:)
      @changes  = changes
      @deployed = deployed
    end

    # Resources declared in Bicep.
    def defined_count
      @changes.size
    end

    # Declared resources that already exist in Azure.
    def deployed_count
      @changes.count(&:deployed?)
    end

    # Declared in Bicep, but not deployed yet.
    def missing
      @changes.select(&:missing?).map(&:resource)
    end

    # In Azure, not declared in Bicep, and not an auto-created child.
    def excess
      undeclared.reject(&:implicit?)
    end

    # In Azure, not declared in Bicep, but auto-created by a parent resource.
    def implicit_excess
      undeclared.select(&:implicit?)
    end

    # Implicit children never count as drift.
    def drift?
      missing.any? || excess.any?
    end

    private

    def undeclared
      @undeclared ||= begin
        declared = @changes.map { |change| change.resource.normalized_id }.to_set
        @deployed.reject { |resource| declared.include?(resource.normalized_id) }
      end
    end
  end

  # ------------------------------------------------------------------
  # Report
  # ------------------------------------------------------------------

  # Renders the human-readable drift report.
  class Report
    def initialize(comparison:, resource_group:, io: $stdout)
      @comparison     = comparison
      @resource_group = resource_group
      @io             = io
    end

    def render
      @io.puts "==> az_compare: #{@resource_group}"
      @io.puts
      @io.puts format("%-22s %d", "Defined in bicep:", @comparison.defined_count)
      @io.puts format("%-22s %d", "Deployed:", @comparison.deployed_count)

      section("Not yet deployed", @comparison.missing)
      section("Excess in Azure, not in bicep", @comparison.excess)
      section("Likely implicit/child resources", @comparison.implicit_excess)

      @io.puts
      @io.puts(@comparison.drift? ? "Result: DRIFT DETECTED" : "Result: IN SYNC")
    end

    private

    def section(title, resources)
      @io.puts
      @io.puts "#{title} (#{resources.size}):"
      if resources.empty?
        @io.puts "  (none)"
        return
      end

      resources.sort_by(&:normalized_id).each do |resource|
        @io.puts "  - #{resource.display_kind}"
        @io.puts "    #{resource.id}"
      end
    end
  end

  # ------------------------------------------------------------------
  # CLI
  # ------------------------------------------------------------------

  # Wires the pieces together and returns a process exit code.
  module CLI
    EXIT_OK    = 0
    EXIT_DRIFT = 1
    EXIT_ERROR = 2

    def self.run(resource_group:, location:, parameters_file:, environment_name: nil,
                 shell: Shell.new, io: $stdout)
      changes = WhatIf.new(
        resource_group:   resource_group,
        location:         location,
        parameters_file:  parameters_file,
        environment_name: environment_name,
        shell:            shell
      ).changes

      deployed = Deployed.new(resource_group: resource_group, shell: shell).resources

      comparison = Comparison.new(changes: changes, deployed: deployed)
      Report.new(comparison: comparison, resource_group: resource_group, io: io).render

      comparison.drift? ? EXIT_DRIFT : EXIT_OK
    end
  end
end
