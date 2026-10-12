module AzdSupport
  module Provisioning
    module EnsureAzdDefaults
      def self.run(config: nil)
        config ||= AzdSupport::Configuration.new
        config.ensure_azd_defaults!
        config
      end
    end
  end
end