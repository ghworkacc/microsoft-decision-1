require_relative "lib/azd_support/version"

Gem::Specification.new do |spec|
  spec.name          = "azd_support"
  spec.version       = AzdSupport::VERSION
  spec.authors       = ["TheNotary"]
  spec.summary       = "Infrastructure automation scripts for supporting azd"
  spec.description   = "Ruby gem wrapping the azd deployment hooks with " \
                       "structured validation, provisioning, and deployment " \
                       "scripts."
  spec.license       = "finders keepers"
  spec.required_ruby_version = ">= 4.0"

  spec.files         = Dir.glob("lib/**/*.rb") + Dir.glob("exe/*")
  spec.bindir        = "exe"
  spec.executables   = Dir.glob("exe/*").map { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "rspec", "~> 3.13"
  spec.add_development_dependency "pry", "~> 0.16.0"
end
