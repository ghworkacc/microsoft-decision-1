# Poc Decide Something

TODO: Describe your project here.

## Run the test server

```
pnpm run dev
```

## Run the tests

```
pnpm run test
```

## Build

You can do a local build which will populate the dist/ folder

```
pnpm run build
```

## Consume from a Vite Project

On terminal:
```
pnpm link ../path_to_this_project_folder
```

In source:
```
import { MyClass } from 'poc-decide-something'

const my = new MyClass();
console.log(`Did it work ${my.speak()}`);
```

## Consume Via Browser without a Bundler

Now consumption of the repo can be done via those dist files generated from the build step.  You can serve those files via a webserver, or on a consuming project, add the dependency and source them from the node_modules folder.

###### Import from node_modules

In the consuming app, run `pnpm install poc-decide-something`.

In any of the javascript sources (must be modules) do...

```
import { MyClass } from './node_modules/poc-decide-something/dist/poc-decide-something-lib.js'
```

Or do it oldschool from the HTML, but I can't remember if this works or is useful and I'm quite busy...

```
<script src="node_modules/poc-decide-something/dist/poc-decide-something-lib.js" type="module"></script>
```


# If Meant as a Stand-Alone Package, try this

This should be put in the `package.json`, because right now it's stubbed up to be used as a microservice within a mono-repo.
```
"files": [
    "dist"
],
"main": "./dist/poc-decide-something-lib.umd.cjs",
"module": "./dist/poc-decide-something-lib.js",
"exports": {
    ".": {
        "import": "./dist/poc-decide-something-lib.js",
        "require": "./dist/poc-decide-something-lib.umd.cjs"
    },
    "./style.css": "./dist/my-lib.css"
},
```

# Development Notes

TODO: delete this section as that it's likely a distraction from whatever you're building.

This template is suitable for bootstraping a javascript library that is

- Consumed in the browser as a minified distribution over a CDN
- Consumed in the browser as an npm package import
- Consumed in a node app as an npm package import

This project bootstraps a javascript package that can build (and run for development) via Vite.  It should be suitable for pure frontend package distributions, wasm distributioins as well as Node stuff.

###### Create Via Vite

```
pnpm create vite
# Framework: Vanilla
# Language: JavaScript
#
# pnpm install
# pnpm run dev
```
Reference: https://vite.dev/guide/build.html#library-mode

###### Add Vitest

```
pnpm add -D vitest
```

Ref: https://vitest.dev/guide/

###### Add Eslint
Copy Pasta party!

```
eslint --init
```
