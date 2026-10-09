module AzdSupport
  # Accumulates step timings and prints a summary table.
  #
  # This class is a pure data structure + formatter — it knows nothing
  # about threads, parallelism, or orchestration. LifecycleRunner owns
  # the execution model and delegates recording/printing here.
  class TimingReport
    def initialize(name)
      @name = name
      @timings = []
      @mutex = Mutex.new
    end

    def banner
      puts "==> [#{@name}] starting at #{Time.now.strftime("%Y-%m-%d %H:%M:%S")}"
    end

    def record(label, dur, kind: :step)
      @mutex.synchronize do
        @timings << [label, dur, kind]
      end
    end

    def record_substep(label, dur)
      record(label, dur, kind: :substep)
    end

    def finalize(total_elapsed)
      puts ""
      puts "==> [#{@name}] timing summary"
      @mutex.synchronize do
        @timings.each do |label, dur, kind|
          marker =
            case kind
            when :parallel_wall
              "  ⏱ "
            when :substep
              "      "
            else
              "    "
            end
          puts "#{marker}#{format_duration(dur).rjust(10)}  #{label}"
        end
      end
      puts "    #{"-" * 10}"
      puts "    #{format_duration(total_elapsed).rjust(10)}  TOTAL"
    end

    def format_duration(secs)
      if secs >= 60
        m, s = secs.divmod(60)
        format("%dm%05.2fs", m, s)
      else
        format("%.2fs", secs)
      end
    end
  end
end
