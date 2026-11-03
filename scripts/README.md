# Scripts

This directory is a Ruby gem (`azd_support`) that implements the azd hook lifecycle scripts referenced in `azure.yaml`.

## Structure

```
scripts/
├── exe/                         # Hook entry points (called by azd)
│   ├── preprovision             # Runs before `azd provision`
│   ├── postprovision            # Runs after `azd provision`
│   ├── predeploy                # Runs before `azd deploy`
│   └── postdeploy               # Runs after `azd deploy`
├── lib/
│   ├── azd_support.rb               # Main gem loader
│   └── azd_support/
│       ├── version.rb           # Gem version
│       ├── helpers.rb           # Shared helpers (logging, shell, tool detection)
│       └── validation/
│           └── local_environment.rb  # Pre-flight tool & auth checks
└── spec/                        # RSpec tests
```

## How Hooks Work

Each `exe/` script is a thin wrapper that loads the gem and calls a module:

```ruby
#!/usr/bin/env ruby
$LOAD_PATH.unshift(File.expand_path("../lib", __dir__))
require "azd_support"

AzdSupport::YourModule.run
```

azd invokes these via the `hooks:` section in `azure.yaml`.

## Running Tests

```
cd scripts
bundle install
bundle exec rspec
```

## On-demand demo repair

The tenant policy hides demo storage accounts between demonstrations by
disabling public network access and removing the `SecurityControl=ignore` tag.
Run the repair command on demo day to restore the Flex Consumption deployment
path for the active anonymous Function App:

```sh
scripts/exe/fix --dry-run
scripts/exe/fix
```

The command resolves the Function App and its `AzureWebJobsStorage__accountName`
setting from the active azd environment, merges the exemption tag without
overwriting other tags, verifies the resulting storage account state, and runs
`azd deploy api` so the Flex host reloads the deployment package. The dry run
performs none of these changes or the deployment.

