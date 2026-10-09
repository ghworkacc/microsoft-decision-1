require "open3"

# Shared helpers for the azd_support infrastructure scripts.
#
# Usage:
#   require "azd_support/helpers"
#   include AzdSupport::Helpers
#
module AzdSupport
  module Helpers
    REPO_ROOT = File.expand_path("../../..", __dir__)

    # ---------------------------------------------------------------
    # Logging
    # ---------------------------------------------------------------

    def log(msg)
      $stdout.puts "==> #{msg}"
    end

    def warn_msg(msg)
      $stderr.puts "==> WARN: #{msg}"
    end

    def fail!(msg)
      abort "ERROR: #{msg}"
    end

    # ---------------------------------------------------------------
    # General utilities
    # ---------------------------------------------------------------

    def blank?(val)
      val.nil? || val.to_s.strip.empty?
    end

    # ---------------------------------------------------------------
    # Shell execution
    # ---------------------------------------------------------------

    # Run a command, printing combined stdout+stderr.
    # Aborts on non-zero exit unless +allow_failure+ is true.
    def sh(cmd, allow_failure: false)
      output, status = Open3.capture2e(cmd)
      unless status.success? || allow_failure
        $stderr.puts output unless output.empty?
        fail! "command failed (exit #{status.exitstatus}): #{cmd}"
      end
      output
    end

    # Run a command, capture stdout only, strip trailing whitespace.
    # Aborts on non-zero exit unless +allow_failure+ is true.
    # Returns empty string on failure when +allow_failure+ is true.
    def sh_capture(cmd, allow_failure: false)
      stdout, stderr, status = Open3.capture3(cmd)
      unless status.success? || allow_failure
        $stderr.puts stderr unless stderr.empty?
        fail! "command failed (exit #{status.exitstatus}): #{cmd}"
      end
      return "" if !status.success? && allow_failure
      stdout.rstrip
    end

    # ---------------------------------------------------------------
    # Tool detection
    # ---------------------------------------------------------------

    def tool_exists?(name)
      system("command -v #{name} >/dev/null 2>&1")
    end
  end
end
