module AzdSupport
  # Wrapper for azd lifecycle hooks with two responsibilities:
  #
  #   1. Time each named step and print a summary table at the end.
  #   2. Run independent steps in parallel via Ruby threads.
  #
  # Typical usage from an exe script:
  #
  #   AzdSupport::LifecycleRunner.run("predeploy") do |runner|
  #     runner.parallel(
  #       enable_access: -> { AzdSupport::Deploy::EnableStorageAccess.run },
  #       other_task:    -> { AzdSupport::Deploy::OtherTask.run },
  #     )
  #     runner.step("final_step") { AzdSupport::Deploy::FinalStep.run }
  #   end
  module LifecycleRunner
    extend AzdSupport::Helpers

    # Wrap a hook body. Yields a Runner that records step timings and prints
    # a summary on exit (success or failure).
    def self.run(name)
      report = TimingReport.new(name)
      runner = Runner.new(report)
      report.banner
      began = monotonic
      begin
        yield runner
      ensure
        report.finalize(monotonic - began)
      end
    end

    def self.monotonic
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end

    # Time a sub-step within a parallel branch (or a top-level step).
    # Composes the label as "<parent>/<label>" when invoked inside a
    # `runner.parallel` thread (parent == that thread's branch label).
    # When no runner is active (ad-hoc invocations / tests) this just
    # times the block and prints inline log lines.
    #
    # Always logs `==> [<full_label>] start` / `... done in Xs` so live
    # tailing shows attribution as work happens.
    def self.timed(label)
      report = Thread.current[:azd_support_report]
      parent = Thread.current[:azd_support_parent_label]
      full_label = parent ? "#{parent}/#{label}" : label.to_s

      puts "==> [#{full_label}] start"
      t0 = monotonic
      begin
        yield
      ensure
        elapsed = monotonic - t0
        report&.record_substep(full_label, elapsed)
        puts "==> [#{full_label}] done in #{format_seconds(elapsed)}"
      end
    end

    def self.format_seconds(secs)
      if secs >= 60
        m, s = secs.divmod(60)
        format("%dm%05.2fs", m, s)
      else
        format("%.2fs", secs)
      end
    end

    # Run a hash of label => callable in parallel threads, each
    # wrapped in `LifecycleRunner.timed(label)` so durations attach as
    # substeps under the active parent. Returns a hash of label =>
    # result. Re-raises the first exception after every thread joins.
    #
    # Use this for fan-out *inside* a parallel branch (or any timed
    # block). For the top-level fan-out that records a parallel-wall
    # row, use `Runner#parallel`.
    def self.concurrent(steps)
      return {} if steps.empty?

      report = Thread.current[:azd_support_report]
      parent = Thread.current[:azd_support_parent_label]

      results = {}
      errors  = {}

      threads = steps.map do |label, callable|
        Thread.new do
          # Inherit report + parent so substep labels compose.
          Thread.current[:azd_support_report] = report
          Thread.current[:azd_support_parent_label] = parent
          begin
            results[label] = timed(label.to_s) { callable.call }
          rescue StandardError => e
            errors[label] = e
          end
        end
      end
      threads.each(&:join)

      if errors.any?
        first_label, first_err = errors.first
        raise first_err, "concurrent step '#{first_label}' failed: #{first_err.message}", first_err.backtrace
      end

      results
    end

    class Runner
      include AzdSupport::Helpers

      def initialize(report)
        @report = report
      end

      # Runs a single named block, recording its wall-clock duration.
      def step(label, &block)
        puts "==> [#{label}] start"
        t0 = LifecycleRunner.monotonic
        result = instance_exec(&block) if block_given?
        elapsed = LifecycleRunner.monotonic - t0
        @report.record(label, elapsed)
        puts "==> [#{label}] done in #{@report.format_duration(elapsed)}"
        result
      end

      # Runs a hash of label => callable in parallel threads.
      #
      # Output from parallel work is allowed to interleave on stdout/stderr.
      # Re-raises the first exception after every thread has been joined.
      def parallel(steps)
        return if steps.empty?

        labels = steps.keys.map(&:to_s)
        puts "==> [parallel] start: #{labels.join(", ")}"
        wall_t0 = LifecycleRunner.monotonic

        results = {}
        errors  = {}
        timings = {}

        threads = steps.map do |label, callable|
          Thread.new do
            label_s = label.to_s
            # Make the report + the parent label visible to anything
            # the callable invokes via LifecycleRunner.timed, so substep
            # timings are recorded against the right parent.
            Thread.current[:azd_support_report] = @report
            Thread.current[:azd_support_parent_label] = label_s
            t0 = LifecycleRunner.monotonic
            begin
              results[label_s] = callable.call
            rescue StandardError => e
              errors[label_s] = e
            ensure
              timings[label_s] = LifecycleRunner.monotonic - t0
            end
          end
        end

        threads.each(&:join)
        wall_elapsed = LifecycleRunner.monotonic - wall_t0

        steps.each_key do |label|
          label_s = label.to_s
          @report.record(label_s, timings[label_s] || 0.0)
        end

        @report.record("parallel(#{labels.join(",")})", wall_elapsed, kind: :parallel_wall)
        puts "==> [parallel] done in #{@report.format_duration(wall_elapsed)} (sum of children: " \
             "#{@report.format_duration(timings.values.sum)})"

        if errors.any?
          first_label, first_err = errors.first
          errors.each do |lbl, err|
            warn "==> [parallel] step '#{lbl}' raised: #{err.class}: #{err.message}"
          end
          raise first_err, "parallel step '#{first_label}' failed: #{first_err.message}", first_err.backtrace
        end

        results
      end
    end
  end
end
