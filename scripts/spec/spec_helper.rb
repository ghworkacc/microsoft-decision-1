require "pry"

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.max_formatted_output_length = nil # Prevents rspec from truncating diffs
  end
  
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.around do |example|
    original_stdout = $stdout
    original_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
    example.run
  ensure
    $stdout = original_stdout
    $stderr = original_stderr
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.filter_run_excluding integration: true
  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed
end
