const c = require('kleur');
const path = require('path');
const fs = require('fs-extra');
const which = require('which');
const readPkgUp = require('read-pkg-up');
const spawn = require('cross-spawn');
const Module = require('module');

exports.readFile = fs.readFile;

////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line no-console
const stdout = console.log.bind(console);
exports.stdout;

const stderr = console.error.bind(console);
exports.stderr;

function print(msg) {
	stdout(`${c.cyan('info')} - ${msg}`);
}
exports.print = print;

function printWarn(msg) {
	stdout(`${c.yellow('warn')} - ${msg}`);
}
exports.printWarn = printWarn;

function printErr(msg, offset) {
	if (offset) {
		stderr(`        ${msg}`);
	} else {
		stderr(`${c.red('err ')} - ${msg}`);
	}
}
exports.printErr = printErr;

function logError(err, { printLoc, printStack }) {
	if (err == null) {
		stderr();
		return;
	}

	const error = err.error || err;
	const description = `${error.name ? error.name + ': ' : ''}${
		error.message || error
	}`;
	const message = error.plugin
		? `(${error.plugin} plugin) ${description}`
		: description;

	printErr(message.replace('Error:', '').trim());

	if (printLoc && error.loc) {
		printErr(
			c.dim(`at ${error.loc.file}:${error.loc.line}:${error.loc.column}`),
			true,
		);
	}

	if (printStack && err.stack) {
		const headlessStack = error.stack
			.replace(message, '')
			.split('\n')
			.filter(s => s.length)
			.map(s => s.trim());

		headlessStack.forEach(s => {
			printErr(c.dim(s), true);
		});
	}

	stderr();
}
exports.logError = logError;

////////////////////////////////////////////////////////////////////////////////

function appDir() {
	const { path: rootPath } = readPkgUp.sync({ normalize: false });
	return path.dirname(rootPath || '');
}
exports.appDir = appDir;

function fromRoot(...p) {
	const root = appDir();
	return path.join(root, ...p);
}
exports.fromRoot = fromRoot;

function isDir(name) {
	return fs
		.stat(name)
		.then(stats => stats.isDirectory())
		.catch(() => false);
}
exports.isDir = isDir;

function isFile(name) {
	return fs
		.stat(name)
		.then(stats => stats.isFile())
		.catch(() => false);
}
exports.isFile = isFile;

////////////////////////////////////////////////////////////////////////////////

function runCMD(commands) {
	const [bin, ...cmds] = commands;

	return new Promise((resolve, reject) => {
		const cmd = spawn(bin, cmds, { stdio: 'inherit' });

		cmd.on('close', code => {
			if (code) {
				reject();
			} else {
				resolve();
			}
		});
	});
}
exports.runCMD = runCMD;

////////////////////////////////////////////////////////////////////////////////

const regex = '@[a-z\\d][\\w-.]+/';
function removePkgScope(str) {
	let regexp = new RegExp(regex, 'gi');
	return str.replace(regexp, '');
}
exports.removePkgScope = removePkgScope;

////////////////////////////////////////////////////////////////////////////////

function resolveBin(
	depName,
	{ executable = removePkgScope(depName), cwd = process.cwd() } = {},
) {
	let pathFromWhich;
	try {
		pathFromWhich = fs.realpathSync(which.sync(executable));
		if (pathFromWhich && pathFromWhich.includes('.CMD')) return pathFromWhich;
	} catch (_error) {
		// silence is golden
	}

	try {
		const modPkgPath = require.resolve(`${depName}/package.json`);
		const modPkgDir = path.dirname(modPkgPath);
		const { bin } = require(modPkgPath);
		const binPath = typeof bin === 'string' ? bin : bin[executable];
		const fullPathToBin = path.join(modPkgDir, binPath);
		if (fullPathToBin === pathFromWhich) {
			return executable;
		}
		return fullPathToBin.replace(cwd, '.');
	} catch (error) {
		if (pathFromWhich) {
			return executable;
		}
		throw error;
	}
}
exports.resolveBin = resolveBin;

////////////////////////////////////////////////////////////////////////////////

function parseArgs(opts, options = {}) {
	const keysToFilter = arrify(options.keysToFilter);
	const defaultArgs = arrify(options.defaultArgs);
	const requiredArgs = arrify(options.requiredArgs);

	// Filter out unwanted arguments
	const filterOut = ['_', ...(keysToFilter ? keysToFilter : [])];
	let args = [];
	for (let o in opts) {
		if (!filterOut.includes(o)) {
			if (opts[o] === false) {
				args.push(`--no-${o}`);
			}
			if (opts[o]) {
				args.push(`--${o}`, ...(opts[o] === true ? [] : [opts[o]]));
			}
		}
	}

	// If our arguments array is empty, add default arguments
	if (args.length === 0) {
		args = [...defaultArgs];
	}

	// Append required args if they are not already present
	for (let r of requiredArgs) {
		if (!args.includes(r)) {
			args.push(r);
		}
	}

	return args;
}
exports.parseArgs = parseArgs;

////////////////////////////////////////////////////////////////////////////////

function arrify(value) {
	if (value === null || value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value === 'string') {
		return [value];
	}

	if (typeof value[Symbol.iterator] === 'function') {
		return Array.from(value);
	}

	return [value];
}
exports.arrify = arrify;

////////////////////////////////////////////////////////////////////////////////

async function jsOrTs(cwd, filename) {
	const extension = (await isFile(path.resolve(cwd, filename + '.ts')))
		? '.ts'
		: (await isFile(path.resolve(cwd, filename + '.tsx')))
		? '.tsx'
		: '.js';

	return path.resolve(cwd, `${filename}${extension}`);
}
exports.jsOrTs = jsOrTs;

////////////////////////////////////////////////////////////////////////////////

function getTime(hrTime) {
	const truncate = (num, digits = 3) => {
		num = num.toString();
		num = num.slice(0, num.indexOf('.') + digits);
		return Number(num);
	};

	const ns = hrTime[0] * 1e9 + hrTime[1];
	const ms = ns / 1e6;
	const s = truncate(ns / 1e9, 3);
	const min = ns / 6e10;

	return { ns, ms, s, min };
}
exports.getTime = getTime;

function stopwatch() {
	let hrStart = process.hrtime();
	return () => {
		const hrEnd = process.hrtime(hrStart);

		if (process.env.NODE_ENV === 'test') {
			return { ns: 0, ms: 0, s: 0, min: 0 };
		}

		return getTime(hrEnd);
	};
}
exports.stopwatch = stopwatch;

////////////////////////////////////////////////////////////////////////////////
// Convert booleans and int define= values to literals.
// This is more intuitive than `jvdx build --define A=1` producing A="1".
function toReplacementExpression(value, name) {
	// --define A="1",B='true' produces string:
	const matches = value.match(/^(['"])(.+)\1$/);
	if (matches) {
		return [JSON.stringify(matches[2]), name];
	}

	// --define @assign=Object.assign replaces expressions with expressions:
	if (name[0] === '@') {
		return [value, name.substring(1)];
	}

	// --define A=1,B=true produces int/boolean literal:
	if (/^(true|false|\d+)$/i.test(value)) {
		return [value, name];
	}

	// default: string literal
	return [JSON.stringify(value), name];
}
exports.toReplacementExpression = toReplacementExpression;

////////////////////////////////////////////////////////////////////////////////
// Parses values of the form "$=jQuery,React=react" into key-value object pairs.
function parseMappingArgument(globalStrings, processValue) {
	const globals = {};
	globalStrings.split(',').forEach(globalString => {
		let [key, value] = globalString.split('=');
		if (processValue) {
			const r = processValue(value, key);
			if (r !== undefined) {
				if (Array.isArray(r)) {
					[value, key] = r;
				} else {
					value = r;
				}
			}
		}
		globals[key] = value;
	});
	return globals;
}
exports.parseMappingArgument = parseMappingArgument;

////////////////////////////////////////////////////////////////////////////////
// Parses values of the form "$=jQuery,React=react" into key-value object pairs.
function parseAliasArgument(aliasStrings) {
	return aliasStrings.split(',').map(str => {
		let [key, value] = str.split('=');
		return { find: key, replacement: value };
	});
}
exports.parseAliasArgument = parseAliasArgument;

////////////////////////////////////////////////////////////////////////////////
// Test if a given object is truthy
function isTruthy(obj) {
	if (!obj) {
		return false;
	}
	return obj.constructor !== Object || Object.keys(obj).length > 0;
}
exports.isTruthy = isTruthy;

////////////////////////////////////////////////////////////////////////////////

function resolveFrom(fromDirectory, moduleId, silent) {
	if (typeof fromDirectory !== 'string') {
		throw new TypeError(
			`Expected \`fromDir\` to be of type \`string\`, got \`${typeof fromDirectory}\``,
		);
	}

	if (typeof moduleId !== 'string') {
		throw new TypeError(
			`Expected \`moduleId\` to be of type \`string\`, got \`${typeof moduleId}\``,
		);
	}

	try {
		fromDirectory = fs.realpathSync(fromDirectory);
	} catch (error) {
		if (error.code === 'ENOENT') {
			fromDirectory = path.resolve(fromDirectory);
		} else if (silent) {
			return;
		} else {
			throw error;
		}
	}

	const fromFile = path.join(fromDirectory, 'noop.js');

	const resolveFileName = () =>
		Module._resolveFilename(moduleId, {
			id: fromFile,
			filename: fromFile,
			paths: Module._nodeModulePaths(fromDirectory),
		});

	if (silent) {
		try {
			return resolveFileName();
		} catch (error) {
			return;
		}
	}

	return resolveFileName();
}
exports.resolveFrom = resolveFrom;

////////////////////////////////////////////////////////////////////////////////

/**
 * escapeStringRegexp escapes RegExp special characters.
 * Inspired by https://github.com/sindresorhus/escape-string-regexp
 * (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 * @param {string} string
 * @returns {string}
 */
function escapeStringRegexp(string) {
	if (typeof string !== 'string') return string;
	// NOTE(joel): Use a simple backslash escape when it’s always valid, and a
	// `\xnn` escape when the simpler form would be disallowed by Unicode
	// patterns’ stricter grammar.
	return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}
exports.escapeStringRegexp = escapeStringRegexp;
