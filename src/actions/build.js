const fs = require('fs-extra');
const { EOL } = require('os');
const { resolve, basename, extname, dirname, relative } = require('path');
const { red, bold, underline, dim } = require('kleur');
const glob = require('tiny-glob/sync');
const { map, series } = require('asyncro');
const { escapeStringRegexp } = require('../utils');
const autoprefixer = require('autoprefixer');
const { rollup, watch } = require('rollup');
const commonjs = require('@rollup/plugin-commonjs');
const { default: babel } = require('@rollup/plugin-babel');
const customBabel = require('../shared/babel-custom');
const builtinModules = require('builtin-modules');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const terser = require('@rollup/plugin-terser');
const alias = require('@rollup/plugin-alias');
const postcss = require('rollup-plugin-postcss');
const typescript = require('rollup-plugin-typescript2');
const json = require('@rollup/plugin-json');
const offmainthread = require('@surma/rollup-plugin-off-main-thread');
const {
	print,
	printErr,
	readFile,
	stopwatch,
	isDir,
	jsOrTs,
	removePkgScope,
	parseMappingArgument,
	toReplacementExpression,
	parseAliasArgument,
	isTruthy,
	printWarn,
	arrify,
	resolveFrom,
	camelCase,
} = require('../utils');
const { shouldCssModules, cssModulesConfig } = require('../shared/css-modules');
const { normalizeMinifyOptions } = require('../shared/terser');
const { getSizeInfo } = require('../shared/compressed-size');
const { clean } = require('./clean');

const WATCH_OPTS = {
	exclude: 'node_modules/**',
};

const BUILD_EXTENSIONS = /(\.(umd|cjs|es|m))?\.([cm]?[tj]sx?)$/;

async function build(opts) {
	const stop = stopwatch();

	opts.entries = arrify(opts.entry).concat(opts._);
	if (opts.compress != null) {
		// Convert `--compress true/false/1/0` to booleans:
		if (typeof opts.compress !== 'boolean') {
			opts.compress = opts.compress !== 'false' && opts.compress !== '0';
		}
	} else {
		// the default compress value is `true` for web, `false` for Node:
		opts.compress = opts.target !== 'node';
	}

	let options = { ...opts };

	options.cwd = resolve(process.cwd(), opts.cwd);
	const cwd = options.cwd;

	const { hasPackageJson, pkg } = await getConfigFromPkgJson(cwd);
	options.pkg = {
		...pkg,
		...pkg.publishConfig,
	};

	const { finalName, pkgName } = getName({
		name: options.name,
		pkgName: options.pkg.name,
		amdName: options.pkg.amdName,
		hasPackageJson,
		cwd,
	});

	options.name = finalName;
	options.pkg.name = pkgName;

	if (options.sourcemap === 'inline') {
		printWarn('Inline sourcemaps should only be used for debugging purposes.');
	} else if (options.sourcemap === 'false') {
		options.sourcemap = false;
	} else if (options.sourcemap !== false) {
		options.sourcemap = true;
	}

	options.input = await getInput({
		entries: options.entries,
		cwd,
		source: options.pkg.source,
		module: options.pkg.module,
	});

	options.output = await getOutput({
		cwd,
		output: options.output,
		pkgMain: options.pkg.main,
		pkgName: options.pkg.name,
	});

	options.entries = await getEntries({
		cwd,
		input: options.input,
	});

	options.multipleEntries = options.entries.length > 1;

	let formats = (options.format || options.formats).split(',');
	// de-dupe formats and convert "esm" to "es":
	formats = Array.from(new Set(formats.map(f => (f === 'esm' ? 'es' : f))));
	// Always compile cjs first
	formats.sort((a, b) => (a === 'cjs' ? -1 : a > b ? 1 : 0));

	// Create build steps for each build entry
	let steps = [];
	for (let i = 0; i < options.entries.length; i++) {
		for (let j = 0; j < formats.length; j++) {
			steps.push(
				createConfig(
					options,
					options.entries[i],
					formats[j],
					i === 0 && j === 0,
				),
			);
		}
	}

	// Conditionally clean output directory
	if (options.clean) {
		await clean({
			_: arrify(dirname(options.output).replace(process.cwd(), '.')),
		});
	}

	if (options.watch) {
		return doWatch(options, cwd, steps);
	}

	let cache;
	let out = await series(
		steps.map(config => async () => {
			const { inputOptions, outputOptions } = config;
			if (inputOptions.cache !== false) {
				inputOptions.cache = cache;
			}

			let bundle = await rollup(inputOptions);
			cache = bundle;
			await bundle.write(outputOptions);
			return await config._sizeInfo;
		}),
	);

	const { s } = stop();

	const fileOutput = out
		.map(bundles =>
			bundles
				.map(b => {
					if (b == null) return null;
					const base = b.base ? `${b.base}\n` : '';
					const gzip = b.gzip ? dim(`  -> ${b.gzip}\n`) : '';
					const brotli = b.brotli ? dim(`  -> ${b.brotli}\n`) : '';
					return base + gzip + brotli;
				})
				.filter(Boolean)
				.join('\n'),
		)
		.filter(Boolean)
		.join('');

	const output =
		`Built in ${bold(`${s}s`)}\n` +
		`\n` +
		`${underline('Bundle(s)')}\n` +
		`${fileOutput}`;

	return { output };
}
exports.build = build;

////////////////////////////////////////////////////////////////////////////////
// Read build configuration from package.json
const getConfigFromPkgJson = async cwd => {
	let hasPackageJson = false;
	let pkg;
	try {
		const packageJson = await readFile(resolve(cwd, 'package.json'), 'utf8');
		pkg = JSON.parse(packageJson);
		hasPackageJson = true;
	} catch (err) {
		const pkgName = basename(cwd);

		let warning = `No package.json, assuming package name is "${pkgName}".\n`;
		let msg = String(err.message || err);
		if (!msg.match(/ENOENT/)) {
			warning += `   ${red().dim(msg)}\n`;
		}
		printWarn(warning);

		pkg = { name: pkgName };
	}

	return { hasPackageJson, pkg };
};

////////////////////////////////////////////////////////////////////////////////

const INVALID_ES3_IDENT = /((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g;

// Return the package name and a normalized version of it
const getName = ({ name, pkgName, amdName, cwd, hasPackageJson }) => {
	if (!pkgName) {
		pkgName = basename(cwd);
		if (hasPackageJson) {
			printWarn(`Missing package.json "name" field. Assuming "${pkgName}".\n`);
		}
	}

	// Normalize a given variable name by removing package scopes and invalid
	// es3 identities
	const normalizePkgName = vName => {
		const normalized = vName.replace(/^@.*\//, '').toLowerCase();
		const identifier = normalized.replace(INVALID_ES3_IDENT, '');
		return camelCase(identifier);
	};

	const finalName = name || amdName || normalizePkgName(pkgName);
	return { finalName, pkgName };
};

////////////////////////////////////////////////////////////////////////////////
// Return the relative paths to all package input files
async function getInput({ entries, cwd, source, module }) {
	const input = [];
	[]
		.concat(
			entries && entries.length
				? entries
				: (source &&
						(Array.isArray(source) ? source : [source]).map(file =>
							resolve(cwd, file),
						)) ||
						((await isDir(resolve(cwd, 'src'))) &&
							(await jsOrTs(cwd, 'src/index'))) ||
						(await jsOrTs(cwd, 'index')) ||
						module,
		)
		.map(file => glob(file))
		.forEach(file => input.push(...file));
	return input;
}

////////////////////////////////////////////////////////////////////////////////
// Return the absolute path to the output bundle
async function getOutput({ cwd, output, pkgMain, pkgName }) {
	let main = resolve(cwd, output || pkgMain || 'dist');
	if (!main.match(/\.[a-z]+$/) || (await isDir(main))) {
		main = resolve(main, `${removePkgScope(pkgName)}.js`);
	}
	return main;
}

////////////////////////////////////////////////////////////////////////////////
// Return the package entry file(s)
async function getEntries({ input, cwd }) {
	let entries = (
		await map([].concat(input), async file => {
			file = resolve(cwd, file);
			if (await isDir(file)) {
				file = resolve(file, 'index.js');
			}
			return file;
		})
	).filter((item, i, arr) => arr.indexOf(item) === i);
	return entries;
}

////////////////////////////////////////////////////////////////////////////////
// Return type declaration output directory
function getDeclarationDir({ options, pkg }) {
	const { cwd, output } = options;

	let result = output;

	if (pkg.types || pkg.typings) {
		result = pkg.types || pkg.typings;
		result = resolve(cwd, result);
	}

	result = dirname(result);

	return result;
}

////////////////////////////////////////////////////////////////////////////////
// Recursively walk the "exports" package.json property

function walkExports(exports, includeDefault) {
	if (!exports) return null;
	if (typeof exports === 'string') return exports;
	let p = exports['.'] || exports.import || exports.module;
	if (!p && includeDefault) p = exports.default;
	return walkExports(p, includeDefault);
}

////////////////////////////////////////////////////////////////////////////////
// Return future main entry files of our bundled output
function getMain({ options, entry, format }) {
	const { pkg } = options;
	const pkgMain = options['pkg-main'];
	const pkgTypeModule = pkg.type === 'module';

	if (!pkgMain) {
		return options.output;
	}

	let mainNoExtension = options.output;
	if (options.multipleEntries) {
		let name = entry.match(
			new RegExp(/([\\/])index/.source + BUILD_EXTENSIONS.source),
		)
			? mainNoExtension
			: entry;
		mainNoExtension = resolve(dirname(mainNoExtension), basename(name));
	}
	mainNoExtension = mainNoExtension.replace(BUILD_EXTENSIONS, '');

	// Converts fileName `/path/to/dist/jvdx` to `/path/to/dist/jvdx.esm.js` when
	// fileNameFormat equals `x.esm.js`
	const replaceName = (fileNameFormat, fileName) =>
		resolve(
			dirname(fileNameFormat),
			fileName + basename(fileNameFormat).replace(/^[^.]+/, ''),
		);

	const mainsByFormat = {};
	mainsByFormat.es = replaceName(
		pkg.module && !pkg.module.match(/src\//)
			? pkg.module
			: pkg['jsnext:main'] || (pkgTypeModule ? 'x.esm.js' : 'x.esm.mjs'),
		mainNoExtension,
	);
	mainsByFormat.modern = replaceName(
		(pkg.exports && walkExports(pkg.exports, pkgTypeModule)) ||
			(pkg.syntax && pkg.syntax.esmodules) ||
			pkg.esmodule ||
			(pkgTypeModule ? 'x.modern.js' : 'x.modern.mjs'),
		mainNoExtension,
	);
	mainsByFormat.cjs = replaceName(
		pkg['cjs:main'] || (pkgTypeModule ? 'x.cjs' : 'x.js'),
		mainNoExtension,
	);
	mainsByFormat.umd = replaceName(
		pkg['umd:main'] || pkg.unpkg || 'x.umd.js',
		mainNoExtension,
	);

	return mainsByFormat[format] || mainsByFormat.cjs;
}

////////////////////////////////////////////////////////////////////////////////
// Handle building in `watch` mode
function doWatch(options, cwd, steps) {
	const { onStart, onBuild, onError } = options;

	return new Promise((resolve, reject) => {
		const targetDir = './' + relative(cwd, dirname(options.output));
		print(
			`Watching source, compiling to ${bold(targetDir)} ${dim(
				'(Ctrl + C to stop)',
			)}`,
		);

		const watchers = steps.reduce((acc, options) => {
			acc[options.inputOptions.input] = watch(
				Object.assign(
					{
						output: options.outputOptions,
						watch: WATCH_OPTS,
					},
					options.inputOptions,
				),
			).on('event', e => {
				if (e.code === 'START') {
					if (typeof onStart === 'function') {
						onStart(e);
					}
				}
				if (e.code === 'ERROR') {
					printErr(e.error);
					if (typeof onError === 'function') {
						onError(e);
					}
				}
				if (e.code === 'END') {
					if (options._sizeInfo) {
						options._sizeInfo.then(text => {
							for (let entry of text) {
								const base = entry != null && entry.base ? entry.base : '';
								const gzip = entry != null && entry.gzip ? entry.gzip : '';
								const brotli =
									entry != null && entry.brotli ? entry.brotli : '';
								print(`Wrote ${base} ${dim(`(${gzip}; ${brotli})`)}`);
							}
						});
					}
					if (typeof onBuild === 'function') {
						onBuild(e);
					}
				}
			});

			return acc;
		}, {});

		resolve({ watchers });
	});
}

////////////////////////////////////////////////////////////////////////////////

// shebang cache map because the transform only gets run once
const shebang = {};

// Create a babel transform configuration
function createConfig(options, entry, format, writeMeta) {
	let { pkg } = options;

	// Define output aliases
	let outputAliases = {};
	// since we transform src/index.js, we need to rename imports for it:
	if (options.multipleEntries) {
		outputAliases['.'] = './' + basename(options.output);
	}

	// Handle aliasing node modules
	const moduleAliases = options.alias ? parseAliasArgument(options.alias) : [];
	const aliasIds = moduleAliases.map(alias => alias.find);

	// Handle replacement of constants with hard-coded values
	let defines = {};
	if (options.define) {
		defines = Object.assign(
			defines,
			parseMappingArgument(options.define, toReplacementExpression),
		);
	}

	// Set modern flag
	const modern = format === 'modern';

	// Define externals and globals
	let external = ['dns', 'fs', 'path', 'url'].concat(
		options.entries.filter(e => e !== entry),
	);

	// We want to silence rollup warnings for node builtins as
	// rollup-node-resolve treats them as externals anyway
	// @see https://github.com/rollup/plugins/tree/master/packages/node-resolve/#resolving-built-ins-like-fs
	if (options.target === 'node') {
		external = external.concat([/node:.*/], ...builtinModules);
	}

	const peerDeps = Object.keys(pkg.peerDependencies || {});
	if (options.external === 'none') {
		// Bundle everything (external=[])
	} else if (options.external) {
		external = external.concat(peerDeps).concat(
			// CLI --external supports regular expressions
			options.external.split(',').map(str => new RegExp(str)),
		);
	} else {
		external = external
			.concat(peerDeps)
			.concat(Object.keys(pkg.dependencies || {}));
	}

	let globals = external.reduce((globals, name) => {
		// Use raw value for CLI-provided RegExp externals
		if (name instanceof RegExp) name = name.source;

		// Valid JS identifiers are usually library globals
		if (name.match(/^[a-z_$][a-z0-9_\-$]*$/)) {
			globals[name] = camelCase(name);
		}
		return globals;
	}, {});

	if (options.globals && options.globals !== 'none') {
		globals = Object.assign(globals, parseMappingArgument(options.globals));
	}

	let nameCache = {};
	const bareNameCache = nameCache;

	// Support "minify" field and legacy "mangle" field via package.json:
	const rawMinifyValue = options.pkg.minify || options.pkg.mangle || {};
	let minifyOptions = typeof rawMinifyValue === 'string' ? {} : rawMinifyValue;
	const getNameCachePath =
		typeof rawMinifyValue === 'string'
			? () => resolve(options.cwd, rawMinifyValue)
			: () => resolve(options.cwd, 'mangle.json');

	const externalPredicate = new RegExp(
		`^(${external
			.map(ext =>
				ext instanceof RegExp ? ext.source : escapeStringRegexp(ext),
			)
			.join('|')})($|/)`,
	);

	let endsWithNewLine = false;
	function loadNameCache() {
		try {
			const data = fs.readFileSync(getNameCachePath(), 'utf8');
			endsWithNewLine = data.endsWith(EOL);
			nameCache = JSON.parse(data);
			// mangle.json can contain a "minify" field, same format as the pkg.
			// mangle:
			if (nameCache.minify) {
				minifyOptions = Object.assign(
					{},
					minifyOptions || {},
					nameCache.minify,
				);
			}
		} catch (e) {}
	}
	loadNameCache();

	normalizeMinifyOptions(minifyOptions);

	if (nameCache === bareNameCache) nameCache = null;

	const absMain = resolve(options.cwd, getMain({ options, entry, format }));
	const outputDir = dirname(absMain);
	const outputEntryFileName = basename(absMain);
	const targetDir =
		'./' + relative(options.cwd, dirname(options.output)) || '.';

	// Warn about the (somewhat) breaking change in #950
	if (format === 'es' && !pkg.module && outputEntryFileName.endsWith('.mjs')) {
		printWarn(
			'Warning: your package.json does not specify {"type":"module"}. jvdx assumes this is a CommonJS package and is generating ES Modules with the ".mjs" file extension.',
		);
	}

	const useTypescript = extname(entry) === '.ts' || extname(entry) === '.tsx';
	const emitDeclaration = !!(options.generateTypes || pkg.types || pkg.typings);
	const useWorkerLoader = options.workers !== false;

	let config = {
		inputOptions: {
			// Disable Rollup's cache for modern builds to prevent re-use of legacy
			// transpiled modules:
			cache: modern ? false : undefined,
			input: entry,
			external: id => {
				if (id === 'babel-plugin-transform-async-to-promises/helpers') {
					return false;
				}
				if (options.multipleEntries && id === '.') {
					return true;
				}
				if (aliasIds.indexOf(id) >= 0) {
					return false;
				}
				if (external.length === 0) {
					return false;
				}
				return externalPredicate.test(id);
			},
			onwarn: warning => {
				// https://github.com/rollup/rollup/blob/0fa9758cb7b1976537ae0875d085669e3a21e918/src/utils/error.ts#L324
				if (warning.code === 'UNRESOLVED_IMPORT') {
					printWarn(
						`Failed to resolve the module ${warning.source} imported by ${warning.importer}` +
							`\nIs the module installed? Note:` +
							`\n ↳ to inline a module into your bundle, install it to "devDependencies".` +
							`\n ↳ to depend on a module via import/require, install it to "dependencies".`,
					);
					return;
				}
				printWarn(warning.message);
			},
			treeshake: {
				propertyReadSideEffects: false,
			},
			plugins: []
				.concat(
					// Process CSS files with post-css and autoprefixer
					postcss({
						plugins: [autoprefixer()],
						autoModules: shouldCssModules(options),
						modules: cssModulesConfig(options),
						// only write out CSS for the first bundle
						// (avoids pointless extra files)
						inject: false,
						extract:
							!!writeMeta &&
							options.css !== 'inline' &&
							options.output.replace(BUILD_EXTENSIONS, '.css'),
						minimize: options.compress,
						sourceMap: options.sourcemap && options.css !== 'inline',
					}),
					// Process module aliases
					moduleAliases.length > 0 && alias({ entries: moduleAliases }),
					// Locate modules using the Node resolution algorithm
					nodeResolve({
						mainFields: ['module', 'jsnext', 'main'],
						browser: options.target !== 'node',
						exportConditions: [options.target === 'node' ? 'node' : 'browser'],
						// defaults + .jsx
						extensions: ['.mjs', '.js', '.jsx', '.json', '.node'],
						preferBuiltins: options.target === 'node' ? true : undefined,
					}),
					{
						// We have to remove shebang so it doesn't end up in the middle of
						// the code somewhere
						transform: code => ({
							code: code.replace(/^#![^\n]*/, bang => {
								shebang[options.name] = bang;
							}),
							map: null,
						}),
					},
					// Convert CommonJS modules to ES6 modules
					// Use a regex to make sure to include eventual hoisted packages
					commonjs({
						include: /\/node_modules\//,
						esmExternals: false,
						requireReturnsDefault: 'namespace',
					}),
					// Convert .json files to ES6 modules
					json(),
					// Handle Typescript
					(useTypescript || emitDeclaration) &&
						typescript({
							cwd: options.cwd,
							typescript: require(resolveFrom(
								options.cwd,
								'typescript',
								true,
							) || 'typescript'),
							cacheRoot: `./node_modules/.cache/.rts2_cache_${format}`,
							useTsconfigDeclarationDir: true,
							tsconfigDefaults: {
								compilerOptions: {
									sourceMap: options.sourcemap,
									declaration: options.generateTypes !== false,
									allowJs: true,
									emitDeclarationOnly: options.generateTypes && !useTypescript,
									...(options.generateTypes !== false && {
										declarationDir: getDeclarationDir({ options, pkg }),
									}),
									jsx: 'preserve',
									jsxFactory: options.jsx ? 'React.createElement' : undefined,
									jsxFragmentFactory: options.jsx
										? 'React.Fragment'
										: undefined,
								},
								files: options.entries,
							},
							tsconfig: options.tsconfig,
							tsconfigOverride: {
								compilerOptions: {
									module: 'ESNext',
									target: 'ESNext',
								},
							},
						}),
					// If defines is not set, we shouldn't run babel through node_modules
					isTruthy(defines) &&
						babel({
							babelHelpers: 'bundled',
							babelrc: false,
							compact: false,
							configFile: false,
							include: 'node_modules/**',
							plugins: [
								[
									require.resolve('babel-plugin-transform-replace-expressions'),
									{ replace: defines },
								],
							],
						}),
					customBabel()({
						babelHelpers: 'bundled',
						extensions: ['.ts', '.tsx', '.js', '.jsx', '.es6', '.es', '.mjs'],
						// NOTE(joel): Use a regex to make sure to exclude eventual hoisted
						// packages
						exclude: /\/node_modules\//,
						// @see https://babeljs.io/docs/en/options#passperpreset
						passPerPreset: true,
						custom: {
							defines,
							modern,
							compress: options.compress !== false,
							targets: options.target === 'node' ? { node: '14' } : undefined,
							typescript: !!useTypescript,
							jsx: options.jsx || false,
						},
					}),
					options.compress !== false && [
						terser({
							compress: Object.assign(
								{
									keep_infinity: true,
									pure_getters: true,
									// Ideally we'd just get Terser to respect existing Arrow
									// functions...
									// unsafe_arrows: true,
									passes: 10,
								},
								typeof minifyOptions.compress === 'boolean'
									? minifyOptions.compress
									: minifyOptions.compress || {},
							),
							format: {
								// By default, Terser wraps function arguments in extra parens
								// to trigger eager parsing. Whether this is a good idea is way
								// too specific to guess, so we optimize for size by default
								wrap_func_args: false,
								comments: /^\s*([@#]__[A-Z]__\s*$|@cc_on)/,
								preserve_annotations: true,
							},
							module: modern,
							ecma: modern ? 2017 : 5,
							toplevel: modern || format === 'cjs' || format === 'es',
							mangle:
								typeof minifyOptions.mangle === 'boolean'
									? minifyOptions.mangle
									: Object.assign({}, minifyOptions.mangle || {}),
							nameCache,
						}),
						nameCache && {
							// before hook
							options: loadNameCache,
							// after hook
							writeBundle() {
								if (writeMeta && nameCache) {
									const filename = getNameCachePath();
									let json = JSON.stringify(nameCache, null, 2);
									if (endsWithNewLine) json += EOL;
									fs.writeFile(filename, json, () => {});
								}
							},
						},
					],
					// Off-Main-Thread only works with amd and esm.
					// @see: https://github.com/surma/rollup-plugin-off-main-thread#config
					useWorkerLoader && (format === 'es' || modern) && offmainthread(),

					/** @type {import('rollup').Plugin} */
					({
						name: 'postprocessing',
						// Rollup 2 injects `globalThis`, which is nice, but doesn't really
						// make sense for jvdx. Only ESM environments necessitate
						// `globalThis`, and UMD bundles can't be properly loaded as ESM.
						// So we remove the `globalThis` check, replacing it with
						// `this||self` to match Rollup 1's output
						renderChunk(code, chunk, opts) {
							if (opts.format === 'umd') {
								// minified:
								code = code.replace(
									/([a-zA-Z$_]+)="undefined"!=typeof globalThis\?globalThis:(\1\|\|self)/,
									'$2',
								);
								// unminified:
								code = code.replace(
									/(global *= *)typeof +globalThis *!== *['"]undefined['"] *\? *globalThis *: *(global *\|\| *self)/,
									'$1$2',
								);
								return { code, map: null };
							}
						},
						writeBundle(_, bundle) {
							config._sizeInfo = Promise.all(
								Object.values(bundle).map(({ code, fileName }) => {
									if (code) {
										return getSizeInfo(
											code,
											`${dim(targetDir + '/')}${fileName}`,
											options.raw,
										);
									}
									return null;
								}),
							);
						},
					}),
				)
				.filter(Boolean),
		},

		outputOptions: {
			paths: outputAliases,
			globals,
			strict: options.strict === true,
			freeze: false,
			esModule: false,
			sourcemap: options.sourcemap,
			get banner() {
				return shebang[options.name];
			},
			format: modern ? 'es' : format,
			name: options.name && options.name.replace(/^global\./, ''),
			extend: /^global\./.test(options.name),
			dir: outputDir,
			entryFileNames: outputEntryFileName,
			exports: 'auto',
		},
	};

	return config;
}
