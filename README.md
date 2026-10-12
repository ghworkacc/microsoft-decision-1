# Microsoft-Decision-1

A React single-page app for **Microsoft-Decision-1**, using its "System 1" API on Microsoft Foundry. You enter a question, a list of choices and some state text (for example, a conversation transcript). The model picks a choice and returns its confidence and the probability of each option.

There are two deployment modes, currently I've set it to anonymous access mode.


## Quick Start

```sh
azd config set alpha.deployment.stacks on   # required, see "Infrastructure" below
                                             # (or per shell: export AZD_ALPHA_ENABLE_DEPLOYMENT_STACKS=true)

azd up                                       # deploys the model + app registration, writes frontend/.env.local

cd frontend
pnpm install
pnpm dev                                     # http://localhost:5173
```

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd), with the `deployment.stacks` alpha feature enabled
- [Ruby](https://www.ruby-lang.org/en/documentation/installation/) (for hook scripts)
- [Node.js](https://nodejs.org/en/download) and [pnpm](https://pnpm.io/installation)
- Permission to create model deployments on the `the-new-foundry` account and to create Entra app registrations

The `preprovision` hook checks all of these.

## Infrastructure

Everything is defined in Bicep. The Foundry account `the-new-foundry` (resource group `the-new-foundry`) is shared and already exists. It is only ever referenced, never declared.

| What | Where | Deployed by |
| --- | --- | --- |
| Model deployment `msft-decision-1` (Microsoft-Decision-1 v1, `GlobalStandard`) | [infra/main.bicep](infra/main.bicep), [infra/modules/decision-deployment.bicep](infra/modules/decision-deployment.bicep) | azd, as a deployment stack |
| Entra app registration (SPA redirect URIs, Cognitive Services `user_impersonation`) | [infra/identity/app-registration.bicep](infra/identity/app-registration.bicep) | the `postprovision` hook (`az deployment sub create`) |
| Resource group `rg-poc-decide-something-<env>` with the anonymous proxy: Function app (Flex Consumption, Node 22), storage, Application Insights, Log Analytics, dashboard | [infra/modules/anonymous-api.bicep](infra/modules/anonymous-api.bicep), [infra/modules/dashboard.bicep](infra/modules/dashboard.bicep) | azd, as a deployment stack |
| *Cognitive Services User* on the Foundry account for the Function's managed identity | [infra/modules/foundry-role-assignment.bicep](infra/modules/foundry-role-assignment.bicep) | azd, as a deployment stack |

Why the split:

- **Deployment stacks keep `azd down` safe.** Without stacks, `azd down` deletes *every resource group* that a deployment touched, and that would include the shared `the-new-foundry` group. With stacks (`actionOnUnmanage: resources delete, resourceGroups delete` in [azure.yaml](azure.yaml)), `azd down` deletes only what the stack manages: the `msft-decision-1` deployment, the proxy's role assignment and the `rg-poc-decide-something-<env>` resource group. The shared group is only referenced, so the stack never manages it.
- **Deployment stacks don't support the Microsoft Graph Bicep extension.** azd's stacks flag applies to every Bicep deployment it makes, so the app registration is deployed as a regular subscription deployment from the hook. The `postdown` hook deletes it again.

The deployment name avoids the word "Microsoft" because azd rejects deployment names that contain reserved words.

### Settings

Set these with `azd env set <NAME> <value>` before `azd provision`:

| Name | Default | Purpose |
| --- | --- | --- |
| `SPA_REDIRECT_URIS` | `http://localhost:5173` | Comma-separated SPA redirect URIs. Add your production origin here, e.g. `http://localhost:5173,https://decide.example.com` |
| `DECISION_CAPACITY` | `10` | Deployment capacity (1 unit = 1 request per minute) |
| `ANONYMOUS_MODE` | `false` | `true` lets anyone use the app without signing in, through the rate-limited proxy. See [Anonymous mode](#anonymous-mode) |
| `ANONYMOUS_CORS_ORIGINS` | `https://ghworkacc.github.io,http://localhost:5173` | Comma-separated browser origins allowed to call the proxy |
| `ANONYMOUS_RATE_LIMIT_PER_MINUTE` | `5` | Proxy requests allowed per client IP per minute |

### Outputs

The postprovision hook writes these to the azd environment and also to `frontend/.env.local`:

| azd env | Vite env |
| --- | --- |
| `ENTRA_CLIENT_ID` | `VITE_ENTRA_CLIENT_ID` |
| `AZURE_TENANT_ID` | `VITE_ENTRA_TENANT_ID` |
| `FOUNDRY_ENDPOINT` | `VITE_FOUNDRY_ENDPOINT` |
| `DECISION_DEPLOYMENT_NAME` | `VITE_DECISION_DEPLOYMENT` |
| `ANONYMOUS_MODE` | `VITE_ANONYMOUS_MODE` |
| `DECISION_PROXY_URL` | `VITE_DECISION_PROXY_URL` |

Provisioning also outputs `AZURE_RESOURCE_GROUP`, `ANONYMOUS_FUNCTION_APP_NAME` and `DASHBOARD_URL` (the portal dashboard).

## Anonymous mode

```mermaid
flowchart LR
    Browser -- "POST /api/decision<br/>(no token)" --> Func["Function app<br/>func-&lt;token&gt;"]
    Func -- "count per IP" --> Table[("Table Storage<br/>ratelimits")]
    Func -- "managed identity" --> Foundry["Foundry: the-new-foundry<br/>deployment msft-decision-1"]
    Func -. telemetry .-> AppInsights[Application Insights + dashboard]
```

The Function app in [api/](api/) is always deployed, but it answers every request with `404 AnonymousModeDisabled` unless its `ANONYMOUS_MODE` app setting is `true`. When enabled:

- `GET /api/quota` returns `{ rateLimit: { limit, remaining, resetSeconds } }` without using up a request.
- `POST /api/decision` takes `{ state, questions }`, counts the request against the caller's IP, and forwards it to Foundry with the Function's managed identity. The model is always the configured deployment. Every response includes `rateLimit`, plus `RateLimit-*` headers.
- After `ANONYMOUS_RATE_LIMIT_PER_MINUTE` requests in the current minute, the proxy returns `429 RateLimited` with `Retry-After`, without calling Foundry.
- The counters are fixed one-minute windows, stored as one Table Storage entity per SHA-256-hashed IP. Updates use ETags, so concurrent requests can't over-admit. If storage is unavailable the proxy fails closed with `503`.
- The client IP is the rightmost `X-Forwarded-For` entry, which App Service adds. Values a client adds itself are ignored.
- App Service CORS allows only `ANONYMOUS_CORS_ORIGINS`.
- All access is keyless: the storage account disallows shared keys, and Application Insights requires Entra authentication.

In the frontend, `VITE_ANONYMOUS_MODE=true` skips MSAL. The app shows *"N/M requests left this minute"* next to **Decide**. When the quota runs out, **Decide** opens a modal that explains the cap and counts down to the next minute. The modal closes itself at zero and refreshes the quota.

To turn it on:

```sh
azd env set ANONYMOUS_MODE true
azd up                       # provisions the proxy, deploys api/, rewrites frontend/.env.local
cd frontend && pnpm run publish
```

To turn it off, run `azd env set ANONYMOUS_MODE false` and `azd provision`. The proxy then refuses all requests, and the next build signs users in again. After code-only changes to `api/`, `azd deploy api` is enough.

### Dashboard

`DASHBOARD_URL` opens a shared portal dashboard (in the proxy resource group) with three Log Analytics charts over Application Insights `requests`: requests per minute by status code, requests per minute by function, and rate-limited (429) requests per minute.

## Build for Deployment

```sh
cd frontend
pnpm build      # minified, ready-to-serve static files in frontend/dist/
pnpm run publish
```

Vite inlines the `VITE_*` values at build time, so build after `azd provision`. Serve `dist/` from any static host whose origin is listed in `SPA_REDIRECT_URIS`. You can check the build locally with `pnpm preview`, which serves it on the same `http://localhost:5173` origin.

## Project Structure Highlights

```sh
poc-decide-something/
├── azure.yaml                         # azd project definition (infra, deployment stack settings, hooks)
├── infra/
│   ├── main.bicep                     # azd entry point: model deployment + anonymous proxy (deployment stack)
│   ├── main.bicepparam
│   ├── bicepconfig.json               # Microsoft Graph Bicep extension
│   ├── modules/
│   │   ├── decision-deployment.bicep  # accounts/deployments on the existing Foundry account
│   │   ├── anonymous-api.bicep        # Flex Consumption Function app, storage, App Insights
│   │   ├── foundry-role-assignment.bicep # Function identity -> Cognitive Services User
│   │   └── dashboard.bicep            # requests/minute portal dashboard
│   └── identity/
│       ├── app-registration.bicep     # Entra SPA app registration (Graph)
│       └── app-registration.bicepparam
├── api/                               # Rate-limited anonymous proxy (Azure Functions, Node 22)
├── frontend/                          # React + MSAL SPA (see frontend/README.md)
└── scripts/                           # Ruby gem for azd hook lifecycle
    ├── exe/                           # Lifecycle hooks for azd
    └── spec/integration               # Integration tests for deployed services
```

## Development

Hook scripts live under `scripts/` as a Ruby gem. See [scripts/README.md](scripts/README.md) for how to add new hook logic.

- `preprovision`: checks tools, logins and the `deployment.stacks` alpha flag.
- `preprovision`: also initializes missing deployment settings in the active azd environment; existing `azd env set` values are preserved.
- `postprovision`: deploys the app registration, then writes `frontend/.env.local`.
- `predown`: stops `azd down` if deployment stacks are off. Without stacks, azd would delete the shared resource group.
- `postdown`: deletes the app registration.

```sh
cd scripts && bundle exec rspec          # hook unit tests
cd frontend && pnpm test && pnpm lint    # frontend unit tests + lint
cd api && npm install && npm test && npm run lint # proxy unit tests + lint
cd frontend && pnpm run integration-test # frontend integration tests
```

## Running Integration Tests

Live integration tests check behaviour against real, deployed resources (run `azd up` first). To run the integration suite:

```sh
cd scripts/ && bundle exec rake integration
```

[scripts/spec/integration/decision_app_spec.rb](scripts/spec/integration/decision_app_spec.rb) builds the frontend, serves `dist/` with `vite preview`, and checks the page, the bundle's azd-provided config, the app registration and Foundry CORS. It then calls the decision API on the deployed model with an `az account get-access-token` token, used in place of the browser's MSAL sign-in.

[scripts/spec/integration/anonymous_api_spec.rb](scripts/spec/integration/anonymous_api_spec.rb) checks the proxy's CORS rules. If `ANONYMOUS_MODE` is not `true`, it checks that the proxy refuses requests. If it is `true`, it uses up the per-minute quota (up to `ANONYMOUS_RATE_LIMIT_PER_MINUTE` model calls), then checks for the `429` and that a forged `X-Forwarded-For` doesn't get around the limit.
