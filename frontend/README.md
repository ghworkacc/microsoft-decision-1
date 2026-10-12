# Microsoft-Decision-1 (frontend)

A React + MSAL single-page app that sends a question, a list of choices and some state text to the Microsoft-Decision-1 "System 1" API on Microsoft Foundry, then shows the decision.

## Configure

The `azd provision` postprovision hook writes `.env.local` from [.env.template](.env.template). To configure by hand instead, copy the template and fill in the values:

```
VITE_ENTRA_CLIENT_ID=<app registration client id>
VITE_ENTRA_TENANT_ID=<tenant id>
VITE_FOUNDRY_ENDPOINT=https://the-new-foundry.services.ai.azure.com
VITE_DECISION_DEPLOYMENT=msft-decision-1
```

## Run the dev server

```
pnpm install
pnpm dev
```

Open http://localhost:5173. The port is fixed (`strictPort`) because it has to match the app registration's SPA redirect URI.

## Run the tests and lint

```
pnpm test
pnpm lint
```

## Build

```
pnpm build
```

This writes minified, ready-to-serve static files to `dist/`. The `VITE_*` values are inlined at build time. `pnpm preview` serves the build on http://localhost:5173.

## Publish to GitHub Pages

GitHub Pages is my favorite static web host. Read about GitHub Pages [here](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages). Or use `pnpm run build` and deploy `dist/` to your own favorite.

```sh
# This will need rework if you choose to deploy
pnpm run publish
```

Use `pnpm run publish`

## Layout

```
src/
├── main.jsx                  # MSAL init + <MsalProvider>
├── App.jsx                   # sign in/out, token acquisition, submit flow
├── authConfig.js             # MSAL config, Foundry scope
├── config.js                 # VITE_* settings
|
├── api/decisionClient.js     # request builder, fetch, response parser
|
├── assets/attachments/       # Demo images
|
├── samples/                  # Demo sample questions and choices
|
├── state/decisionForm.js     # form reducer + demo defaults
|
└── components/               # UI components
```
