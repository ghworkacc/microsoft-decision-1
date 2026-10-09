# Shared template-expansion helpers for interpolating configuration values
# into template files using ${VAR_NAME} syntax.
#
# Usage:
#   require "azd_support/template_helpers"
#   include AzdSupport::TemplateHelpers
#
module AzdSupport
  module TemplateHelpers
    # Regex matching ${VAR_NAME} references in template files.
    VAR_REFERENCE_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/

    # Find template files under +base_dir+ matching +pattern+.
    # Returns an array of absolute paths (may be empty).
    def find_templates(base_dir, pattern)
      Dir.glob(File.join(base_dir, pattern)).sort
    end

    # Extract all unique ${VAR} names referenced in +file+.
    # Returns an array of variable name strings (without ${ }).
    def extract_template_vars(file)
      content = File.read(file)
      content.scan(VAR_REFERENCE_RE).flatten.uniq
    end

    # Validate that every ${VAR} referenced in +file+ is present in the
    # Configuration. Aborts with an error listing any missing vars.
    #
    # A var is considered present if it has any non-nil value, *or* if the
    # KEYS registry declares an explicit default for it (even an empty
    # string). The registered-default case lets templates reference
    # genuinely-optional knobs without forcing operators to set the value.
    def require_template_vars(file, config:)
      vars = extract_template_vars(file)
      env  = config.to_env_hash
      registered_optional = ->(name) {
        spec = AzdSupport::Configuration::KEYS[name]
        spec && spec.key?(:default)
      }
      missing = vars.select do |v|
        next false if registered_optional.call(v)
        env[v].nil? || env[v].to_s.empty?
      end
      return if missing.empty?

      abort "Missing configuration values for template #{file}: #{missing.join(", ")}"
    end

    # Expand a template file using ${VAR} substitution, writing the result
    # to +dest+. Values are drawn from the Configuration object's store.
    def expand_template(src, dest, config:)
      env = config.to_env_hash
      content = File.read(src)
      result = content.gsub(VAR_REFERENCE_RE) { |_match| env[Regexp.last_match(1)] || "" }
      File.write(dest, result)
    end
  end
end
