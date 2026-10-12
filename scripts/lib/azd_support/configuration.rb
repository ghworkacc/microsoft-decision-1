require "open3"
require "shellwords"

module AzdSupport
  # Centralized configuration store for azd hook scripts.
  #
  # All external configuration (azd outputs, environment variables) flows
  # through this class. The KEYS registry documents every external value the
  # scripts depend on.
  #
  # Usage:
  #   config = AzdSupport::Configuration.new
  #   config.load_azd!
  #   config["FOUNDRY_ENDPOINT"]  # => "https://the-new-foundry.services.ai.azure.com"
  #
  class Configuration
    # ------------------------------------------------------------------
    # Key registry
    #
    # Each entry describes one configuration value the scripts may use.
    #   source:    the loading method that typically provides this key
    #   required:  when true, #validate! will fail if the key is missing
    #   default:   value used when no source provides the key (nil = none)
    #   fallbacks: alternative key names checked (in order) when the
    #              primary key is not set
    # ------------------------------------------------------------------
    KEYS = {
      # --- azd infrastructure outputs ---
      "AZURE_ENV_NAME"           => { source: :azd, default: "dev" },
      "AZURE_TENANT_ID"          => { source: :azd },
      "AZURE_LOCATION"           => { source: :azd, default: "eastus2" },
      "FOUNDRY_RESOURCE_GROUP_NAME" => { source: :azd },
      "FOUNDRY_ENDPOINT"         => { source: :azd },
      "DECISION_DEPLOYMENT_NAME" => { source: :azd },
      "DECISION_CAPACITY"        => { source: :azd, default: "10" },
      "FRONTEND_URL"             => { source: :azd, default: "https://ghworkacc.github.io/microsoft-decision-1-example/" },
      "ADDITIONAL_SPA_REDIRECT"  => { source: :azd, default: "" },
      "AZURE_RESOURCE_GROUP"     => { source: :azd },
      "ANONYMOUS_FUNCTION_APP_NAME" => { source: :azd },
      "DECISION_PROXY_URL"       => { source: :azd, default: "" },
      "DASHBOARD_URL"            => { source: :azd },

      # --- anonymous mode inputs (`azd env set`, read by main.bicepparam) ---
      "ANONYMOUS_MODE"           => { source: :azd, default: "false" },
      "ANONYMOUS_CORS_ORIGINS"   => { source: :azd, default: "https://ghworkacc.github.io,http://localhost:5173" },
      "ANONYMOUS_RATE_LIMIT_PER_MINUTE" => { source: :azd, default: "5" },

      # --- set by the postprovision hook (Provisioning::RegisterSpaApp) ---
      "ENTRA_CLIENT_ID"          => { source: :azd },

      # --- Application secrets (loaded from ENV) ---
      "SOME_APP_SECRET"          => { source: :env },
    }.freeze

    def initialize
      @store   = {}
      @sources = []
    end

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    # Retrieve a value by key. Returns nil if the key is not set.
    # Checks the store first, then falls back to registered fallback keys,
    # and finally to the registered default.
    def [](key)
      return @store[key] if @store.key?(key)

      spec = KEYS[key]
      if spec
        # Check fallback keys
        if spec[:fallbacks]
          spec[:fallbacks].each do |fb|
            return @store[fb] if @store.key?(fb)
          end
        end

        # Return default if defined
        return spec[:default] if spec.key?(:default)
      end

      nil
    end

    # Retrieve a value by key, raising KeyError if not found.
    def fetch(key)
      val = self[key]
      return val unless val.nil?

      raise KeyError, "Configuration key not found: #{key}"
    end

    # Store a single key-value pair (used for dynamic runtime values).
    def set(key, value)
      @store[key] = value
    end

    # Returns a flat Hash of all stored key-value pairs, including defaults
    # for any registered keys that have them and haven't been explicitly set.
    # This is the complete variable set available for template expansion.
    def to_env_hash
      result = {}

      # Start with registered defaults
      KEYS.each do |key, spec|
        result[key] = spec[:default] if spec.key?(:default)
      end

      # Overlay with stored values (stored values win over defaults)
      result.merge!(@store)
      result
    end

    # Returns an array of source labels that have been loaded,
    # in the order they were loaded. Useful for debugging.
    def loaded_sources
      @sources.dup
    end

    # Validate that all specified keys are present (non-nil, non-empty).
    # Aborts with a clear error listing any missing keys.
    #
    #   config.validate!("FOUNDRY_ENDPOINT", "ENTRA_CLIENT_ID")
    #
    def validate!(*keys)
      missing = keys.select { |k| val = self[k]; val.nil? || val.to_s.empty? }
      return if missing.empty?

      abort "ERROR: Required configuration values are missing: #{missing.join(", ")}"
    end

    # ------------------------------------------------------------------
    # Source loaders
    # ------------------------------------------------------------------

    # Load all azd environment values. Runs `azd env get-values` and parses
    # the KEY="VALUE" output. Accepts an optional environment name.
    def load_azd!(environment: nil)
      env_flag = environment ? " --environment #{environment}" : ""
      raw = _sh_capture("azd env get-values#{env_flag} 2>/dev/null", allow_failure: true)
      _parse_shell_exports(raw)
      @sources << :azd
    end

    # Materialize registered azd defaults before Bicep runs. This keeps
    # main.bicepparam and postprovision template expansion on the same azd
    # environment, while preserving any value the operator already set.
    def ensure_azd_defaults!
      load_azd! unless @sources.include?(:azd)

      KEYS.each do |key, spec|
        next unless spec[:source] == :azd && spec.key?(:default)
        next if spec[:default].to_s.empty? || !@store[key].to_s.empty?

        _sh_capture("azd env set #{Shellwords.escape(key)} #{Shellwords.escape(spec[:default].to_s)}")
        @store[key] = spec[:default].to_s
      end
      @sources << :azd_defaults
    end

    # Load keys with source: :env from process environment variables.
    # Used for secrets and CI credentials that are injected via ENV.
    def load_env!
      KEYS.each do |key, spec|
        next unless spec[:source] == :env
        val = ENV[key]
        @store[key] = val if val && !val.empty?
      end
      @sources << :env
    end

    # Parse raw KEY="VALUE" output (from any shell-export-style source)
    # and merge into the store.
    def load_shell_exports!(raw)
      _parse_shell_exports(raw)
    end

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    private

    def _parse_shell_exports(raw)
      return if raw.nil? || raw.empty?

      raw.each_line do |line|
        line = line.strip
        next if line.empty? || line.start_with?("#")

        # Strip leading "export " if present
        line = line.sub(/\Aexport\s+/, "")

        if line =~ /\A([A-Za-z_][A-Za-z0-9_]*)=(.*)\z/m
          key = Regexp.last_match(1)
          val = Regexp.last_match(2)

          # Remove surrounding quotes
          val = val[1..-2] if (val.start_with?('"') && val.end_with?('"')) ||
                              (val.start_with?("'") && val.end_with?("'"))

          @store[key] = val
        end
      end
    end

    def _sh_capture(cmd, allow_failure: false)
      stdout, stderr, status = Open3.capture3(cmd)
      unless status.success? || allow_failure
        $stderr.puts stderr unless stderr.empty?
        abort "ERROR: command failed (exit #{status.exitstatus}): #{cmd}"
      end
      return "" if !status.success? && allow_failure
      stdout.rstrip
    end
  end
end
