# Poc Decide Something

TODO: Delete this and the text above, and describe your project

## Quick Start

```
$ git clone https://github.com/TheNotary/poc-decide-something
$ cd poc-decide-something
$ azd up
```

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
- [Ruby](https://www.ruby-lang.org/en/documentation/installation/) (for hook scripts)

## Project Structure Highlights

```sh
poc-decide-something/
├── azure.yaml               # azd project definition (infra + hooks)
│
├── infra/
│   ├── main.bicep           # Subscription-scoped Bicep entry point
│   ├── main.parameters.json # Parameters to the main bicep template 
│   ├── abbreviations.json   # Azure resource naming conventions
│   └── modules/             # Reusable Bicep modules
│       └── storage.bicep    # Example module
│
└── scripts/                 # Ruby gem for azd hook lifecycle
    ├── exe/                 # Lifecycle Hooks for azd
    └── spec/integration     # Integration tests for deployed services
```

## Development

Infrastructure is defined in Bicep under `infra/`. Add new modules in `infra/modules/` and wire them into `infra/main.bicep`.

Hook scripts live under `scripts/` as a Ruby gem. See `scripts/README.md` for details on adding new hook logic.

## Running Integration Tests

Live integration tests should be defined in situations where the system's actual functionality needs to be tested against live resources to prove out the implmentation.  Run the below command to run the integration test suite.

```
cd scripts/ && bundle exec rake integration
```

