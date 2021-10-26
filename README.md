# @jvdx/core

jvdx is a minimal set of tools to help maintain and build better applications.  
It is a single dependency to `bundle`, `lint`, `format` and `test` your library.

## Installation & Usage

(1) Install `@jvdx/core`:

```bash
# Using npm
$ npm i -D @jvdx/core

# Using yarn
$ yarn add -D @jvdx/core
```

(2) Setup your `package.json`

```jsonc
{
  "name": "my-package",                      // Your package name
  "type": "module",
  "source": "src/index.js",                  // Your source code
  "exports": {
    "require": "./dist/my-package.cjs",      // Used for require() in Node 12+
    "default": "./dist/my-package.modern.js" // Where to generate the modern bundle (see below)
  },
  "main": "./dist/my-package.cjs",           // Where to generate the CommonJS bundle
  "module": "./dist/my-package.module.js",   // Where to generate the ESM bundle
  "unpkg": "./dist/my-package.umd.js",       // Where to generate the UMD bundle (also aliased as "umd:main")
  "scripts": {
    "build": "jvdx build",                   // Compiles "source" to "main"/"module"/"unpkg"
    "dev": "jvdx build --watch",             // Re-build when source files change
    "format": "jvdx format",                 // Format sources using prettier
    "lint": "jvdx lint"                      // Lint source using ESLint
  }
}
```

(3) Build your application

```bash
# Using npm
$ npm run build

# Using yarn
$ yarn build
```

## Starter templates

We also provide some starter templates that you can initialize with the
help of [`degit`](https://github.com/Rich-Harris/degit).

  - joelvoss/jvdx-templates/google-cloud-function
  - joelvoss/jvdx-templates/google-cloud-run
  - joelvoss/jvdx-templates/next-app
  - joelvoss/jvdx-templates/node-lib
  - joelvoss/jvdx-templates/node-rest-api
  - joelvoss/jvdx-templates/react-lib

```bash
$ npx degit joelvoss/jvdx-templates/<template-name> my-package
$ cd my-package

# Using npm
$ npm install

# Using yarn
$ yarn
```

## Output Formats

jvdx produces esm _(ECMAScript Modules, e.g. import / export)_,
cjs _(CommonJS, e.g. Node-style module.exports)_ and umd 
_(Universal Module Definition)_ bundles with your code compiled to syntax that
works pretty much everywhere.

While it's possible to customize the browser or Node versions you wish to
support using a [browserslist configuration][browserslist], the default setting is optimal
and strongly recommended.

## Modern Mode <a name="modern"></a>

In addition to the above formats, jvdx also outputs a `modern` bundle
specially designed to work in _all modern browsers_. This bundle preserves
most modern JS features when compiling your code, but ensures the result runs
in 95% of web browsers without needing to be transpiled. Specifically, it uses
Babel's ["bugfixes" mode](https://babeljs.io/blog/2020/03/16/7.9.0#babelpreset-envs-bugfixes-option-11083httpsgithubcombabelbabelpull11083)
(previously known as [preset-modules](https://github.com/babel/preset-modules))
to target the set of browsers that support `<script type="module">` - that
allows syntax like async/await, tagged templates, arrow functions, destructured
and rest parameters, etc. The result is generally smaller and faster to execute
than the plain `esm` bundle.

**This is enabled by default.** All you have to do is add an `"exports"` field
to your `package.json`

## Usage & Configuration

jvdx comes with a variaty of commands, but the most notable are `build`,
`lint`, `format`, `test` and `clean`. Neither require any options/flags, but
they can be tailored to suit your needs if need be.

Each command does exactly what you would expect from it's name.

### `jvdx build`

Builds your code once, it also enables minification and sets the
`NODE_ENV=production` environment variable.  
Unless overridden via the command line, jvdx uses the `source` property in your
`package.json` to determine which of your JavaScript files to start bundling
from (your "entry module").
The filenames and paths for generated bundles in each format are defined by
the `main`, `umd:main`, `module` and `exports` properties in your `package.json`.

```jsonc
{
  "type": "module",
  "source": "src/index.js",                  // Your source code
  "exports": {
    "require": "./dist/my-package.cjs",      // Used for require() in Node 12+
    "default": "./dist/my-package.modern.js" // Where to generate the modern bundle
  },
  "main": "./dist/my-package.cjs",           // Where to generate the CommonJS bundle
  "module": "./dist/my-package.module.js",   // Where to generate the ESM bundle
  "unpkg": "./dist/my-package.umd.js",       // Where to generate the UMD bundle (also aliased as "umd:main")
  "types": "dist/foo.d.ts"                   // TypeScript typings directory
}
```

When deciding which bundle to use, Node.js 12+ and webpack 5+ will prefer the
`exports` property, while older Node.js releases use the `main` property,
and other bundlers prefer the `module` field.

> For more information about the meaning of the different properties, refer
> to the [Node.js documentation](https://nodejs.org/api/packages.html#packages_package_entry_points).

For UMD builds, jvdx will use a camelCase version of the name field in your
`package.json` as export name. This can be customized using an "amdName" key
in your `package.json` or the `--name` command line argument.

### `jvdx lint`

Statically analyzes your code using ESLint.  
Unless overridden via the command line, jvdx lints `.js`,`.jsx`,`.ts`, and
`.tsx` files inside the `./src` directory.

For a full list of options see the [ESLint documentation][eslint-docs].

### `jvdx format`

Formats your code in-place using Prettier.  
Unless overridden via the command line, jvdx uses the following glob pattern
to format all matching files in place:  
`./src/**/*.+(js|json|less|css|ts|tsx|md)`

For a full list of options see the [Prettier documentation][prettier-docs].

### `jvdx test`

Runs your test suite using Jest.
Unless overridden via the command line, jvdx uses the following jest
configuration to test your code:

```js
{
  testEnvironment: 'node',
  testURL: 'http://localhost',
  watchPlugins: [
    require.resolve('jest-watch-typeahead/filename'),
    require.resolve('jest-watch-typeahead/testname'),
  ],
  transform: {
    '^.+\\.jsx?$': require.resolve('babel-jest'),
    '^.+\\.(ts|tsx)$': require.resolve('ts-jest/dist'),
  },
}
```

For a full list of options see the [Jest documentation][eslint-docs].

### `jvdx clean`

Cleans your source repository using rimraf.
Unless overridden via the command line, jvdx removes both `./node_modules` and
`./dist` folders relative to the package root.

```bash
# Removes ./build
$ jvdx clean ./build
```

### Using with TypeScript

Just point the input to a `.ts` file through either the cli or the source key
in your `package.json` and you’re done.
Under the hood jvdx uses the `rollup-plugin-typescript2` plugin to transpile
your TypeScript sources.

jvdx will generally respect your TypeScript config defined in a `tsconfig.json`
file with notable exceptions being the "[target](https://www.typescriptlang.org/tsconfig/#target)"
and "[module](https://www.typescriptlang.org/tsconfig#module)" settings.
To ensure your TypeScript configuration matches the configuration that jvdx
uses internally it's strongly recommended that you set
`"module": "ESNext"` and `"target": "ESNext"` in your `tsconfig.json`.

To ensure jvdx does not process extraneous files, by default it only includes
your entry point. If you want to include other files for compilation, such as
ambient declarations, make sure to add either "[files](https://www.typescriptlang.org/tsconfig#files)"
or "[include](https://www.typescriptlang.org/tsconfig#include)" into your `tsconfig.json`.

If you're using CSS Modules, set `"include": ["node_modules/@jvdx/core/index.d.ts"]`
in your `tsconfig.json` to enable type annotations of your CSS Module imports.

### CSS and CSS Modules

Importing CSS files is supported via `import "./foo.css"`. By default, generated
CSS output is written to disk. The `--css` inline command line option will
inline generated CSS into your bundles as a string, returning the CSS string
from the import:

```js
// with the default external CSS:
import './foo.css';  // generates a minified .css file in the output directory

// with `jvdx build --css inline`:
import css from './foo.css';
console.log(css);  // the generated minified stylesheet
```

**CSS Modules:** CSS files with names ending in `.module.css` are treated as a
[CSS Modules](https://github.com/css-modules/css-modules).
To instead treat imported `.css` files as modules, run jvdx with
`--css-modules true`. To disable CSS Modules for your project, pass
`--no-css-modules` or `--css-modules false`.

The default scope name for CSS Modules is`_[name]__[local]__[hash:base64:5]` in
watch mode, and `_[hash:base64:5]` for production builds.
This can be customized by passing the command line argument
`--css-modules "[name]_[hash:base64:7]"`, using
[these fields and naming conventions](https://github.com/webpack/loader-utils#interpolatename).

| flag  | import                           |   is css module?   |
| ----- | -------------------------------- | :----------------: |
| null  | `import './my-file.css';`        |         ❌         |
| null  | `import './my-file.module.css';` |         ✅         |
| false | `import './my-file.css';`        |         ❌         |
| false | `import './my-file.module.css';` |         ❌         |
| true  | `import './my-file.css';`        |         ✅         |
| true  | `import './my-file.module.css';` |         ✅         |

### Usage with `{"type":"module"}` in `package.json`

Node.js 12.16+ adds ESM support, which can be enabled by adding
`{"type":"module"}` to your `package.json`.
This property [changes the default source type](https://nodejs.org/api/packages.html#packages_determining_module_system)
of `.js` files to be ES Modules instead of CommonJS, thus requiring you to
change the file extension to `.cjs` for CommonJS bundles generated by jvdx.

```jsonc
{
  "type": "module",
  "module": "dist/foo.js",  // ES Module bundle
  "main": "dist/foo.cjs",   // CommonJS bundle
}
```

### Additional build configuration options

You can override the build configuration using the [`publishConfig`](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#publishconfig)
property in your `package.json`.

```jsonc
{
  "main": "src/index.ts",          // Used in local dev environment
  "publishConfig": {
    "source": "src/index.js",      // Input
    "main": "dist/my-library.js",  // Output
  },
  "scripts": {
    "build": "jvdx build"
  }
}
```

### Building a single bundle with a fixed output name

By default jvdx outputs multiple bundles, one bundle per format.
A single bundle with a fixed output name can be built like this:

```bash
$ jvdx -i lib/main.js -o dist/bundle.js --no-pkg-main -f umd
```

### Mangling Properties

To achieve the smallest possible bundle size, libraries often wish to rename
internal object properties or class members to smaller names - transforming
`this._internalIdValue` to `this._i`. jvdx doesn't do this by default,
however it can be enabled by creating a `mangle.json` file (or a "mangle"
property in your `package.json`). Within that file, you can specify a regular
expression pattern to control which properties should be mangled. For example:
to mangle all property names beginning an underscore:

```jsonc
{
  "mangle": {
    "regex": "^_"
  }
}
```

It's also possible to configure repeatable short names for each mangled
property, so that every build of your library has the same output.

### Defining build-time constants

The `--define` option can be used to inject or replace build-time constants
when bundling. In addition to injecting string or number constants, prefixing
the define name with `@` allows injecting JavaScript expressions.

| Build command                       | Source code           | Output                  |
|-------------------------------------|-----------------------|-------------------------|
`jvdx --define VERSION=2`             | `console.log(VERSION)` | `console.log(2)`
`jvdx --define API_KEY='abc123'`      | `console.log(API_KEY)` | `console.log("abc123")`
`jvdx --define @assign=Object.assign` | `assign(a, b)`         | `Object.assign(a, b)`


## All CLI Options

```bash
Usage
  $ jvdx <command> [options]

Available Commands
  clean     Cleans repository and removes `./node_modules` and `./dist`.
  lint      Statically analyzes your code using ESLint.
  format    Formats your code in-place using prettier.
  test      Runs your test suite using Jest.
  build     Builds the assets once, it also enabled minification and sets the NODE_ENV=production environment variable

For more info, run any command with the `--help` flag
  $ jvdx clean --help
  $ jvdx lint --help

Options
  -v, --version    Displays current version
  -h, --help       Displays this message
```

### build

```bash
Usage
  $ jvdx build [...entries] [options]

Options
  -c, --clean        Clean output directory before building.
  -i, --entry        Entry module(s)
  -o, --output       Directory to place build files into
  -f, --format       Only build specified formats (any of modern,es,cjs,umd or iife)  (default modern,es,cjs,umd)
  -w, --watch        Rebuilds on any change  (default false)
  --pkg-main         Outputs files analog to package.json main entries  (default true)
  --target           Specify your target environment (node or web)  (default web)
  --external         Specify external dependencies, or 'none'
  --globals          Specify globals dependencies, or 'none'
  --define           Replace constants with hard-coded values (use @key=exp to replace an expression)
  --alias            Map imports to different modules
  --compress         Compress output using Terser
  --strict           Enforce undefined global context and add "use strict"
  --name             Specify name exposed in UMD builds
  --cwd              Use an alternative working directory  (default .)
  --sourcemap        Generate source map  (default true)
  --generate-types   Generate type definitions (even for non-TS libs)
  --css              Where to output CSS: "inline" or "external"  (default: "external")
  --css-modules      Turns on css-modules for all .css imports. Passing a string will override the scopeName. eg --css-modules="_[hash]"
  --jsx              Enable @babel/preset-react
  --tsconfig         Specify the path to a custom tsconfig.json
  -h, --help         Displays this message

Examples
  $ jvdx build
  $ jvdx build --clean
  $ jvdx build --globals react=React,jquery=$
  $ jvdx build --define API_KEY=1234
  $ jvdx build --alias react=preact
  $ jvdx build --no-sourcemap # don't generate sourcemaps
  $ jvdx build --tsconfig tsconfig.build.json
```

### lint

```bash
Usage
  $ jvdx lint [...files|dir|glob] [options]

Options
  -h, --help    Displays this message

Examples
  $ jvdx lint
```

### format

```bash
Usage
  $ jvdx format [...files|dir|glob] [options]

Options
  -h, --help    Displays this message

Examples
  $ jvdx format
```

### test

```bash
Usage
  $ jvdx test [options]

Options
  -h, --help    Displays this message

Examples
  $ jvdx test
```

### clean

```bash
Usage
  $ jvdx clean [...files|dir|glob] [options]

Options
  -h, --help    Displays this message

Examples
  $ jvdx clean
```

---

[browserslist]: https://github.com/browserslist/browserslist#browserslist-
[eslint-docs]: https://eslint.org/docs/user-guide/command-line-interface
[prettier-docs]: https://prettier.io/docs/en/cli.html
[jest-docs]: https://jestjs.io/docs/en/cli
