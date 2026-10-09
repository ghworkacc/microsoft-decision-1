require "fileutils"

module AzdSupport
  # Tee combined stdout/stderr to REPO_ROOT/logs/<name>.log so that
  # azd lifecycle hooks produce both real-time terminal output and a
  # persistent log file for later inspection.
  #
  # Typical usage from an exe script:
  #
  #   AzdSupport::LogAzd.tee_to_log!("predeploy")
  #
  module LogAzd
    LOG_DIR = File.join(AzdSupport::Helpers::REPO_ROOT, "logs")

    # Dual-write IO wrapper. Every write goes to both the original IO
    # (azd's pipe / terminal) and the log file. Thread-safe via mutex.
    # Does NOT inherit from IO to avoid dual-buffer conflicts on the
    # same fd.
    class TeeIO
      def initialize(original, log_file)
        @original = original
        @log_file = log_file
        @mutex = Mutex.new
      end

      def write(*args)
        @mutex.synchronize do
          args.each do |str|
            s = str.to_s
            @original.write(s)
            @log_file.write(s)
          end
        end
      end

      def puts(*args)
        args = [""] if args.empty?
        args.each do |arg|
          line = arg.to_s
          line = "#{line}\n" unless line.end_with?("\n")
          write(line)
        end
        nil
      end

      def print(*args)
        args.each { |a| write(a.to_s) }
        nil
      end

      def printf(fmt, *args)
        write(format(fmt, *args))
      end

      def <<(obj)
        write(obj.to_s)
        self
      end

      def flush
        @original.flush
        @log_file.flush
      end

      def sync
        @original.sync
      end

      def sync=(val)
        @original.sync = val
        @log_file.sync = val
      end

      def fileno
        @original.fileno
      end

      def isatty
        @original.isatty
      end
      alias_method :tty?, :isatty

      def close
        @log_file.close
      end
    end

    def self.tee_to_log!(name)
      return if @tee_installed
      @tee_installed = true

      FileUtils.mkdir_p(LOG_DIR)
      log_path = File.join(LOG_DIR, "#{name}.log")

      # Disable Ruby's internal buffering on the real IOs BEFORE
      # anything writes. Critical when stdout/stderr are pipes (azd).
      STDOUT.sync = true
      STDERR.sync = true

      log_file = File.open(log_path, "w")
      log_file.sync = true

      $stdout = TeeIO.new(STDOUT, log_file)
      $stderr = TeeIO.new(STDERR, log_file)

      at_exit do
        $stdout.flush rescue nil
        $stderr.flush rescue nil
        $stdout = STDOUT
        $stderr = STDERR
        log_file.close rescue nil
      end

      log_path
    end
  end
end
