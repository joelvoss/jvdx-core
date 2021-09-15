const { resolve, extname } = require('path');
const shellQuote = require('shell-quote');
const { promisify } = require('es6-promisify');
const _rimraf = require('rimraf');
const { fromRoot, readFile } = require('../utils');
const createProg = require('../prog');
const { build } = require('../actions/build');
const fs = require('fs');
const { basename, join } = require('path');

const rimraf = promisify(_rimraf);

///////////////////////////////////////////////////////////////////////////////

const FIXTURES_DIR = fromRoot(`tests/__fixtures__/actions-build`);
const DEFAULT_SCRIPT = 'jvdx build';

const printTree = (nodes, indentLevel = 0) => {
	const indent = '  '.repeat(indentLevel);
	return nodes
		.filter(node => node.name[0] !== '.')
		.map(node => {
			const isDir = node.type === 'directory';
			return `${indent}${node.name}\n${
				// eslint-disable-next-line no-unused-vars
				isDir ? printTree(node.children, indentLevel + 1) : ''
			}`;
		})
		.join('');
};
exports.printTree = printTree;

///////////////////////////////////////////////////////////////////////////////

const parseScript = (() => script => {
	let parsed;
	const prog = createProg((_, _parsed) => (parsed = _parsed));
	const argv = shellQuote.parse(`node ${script}`);

	// default to non-modern formats
	let hasFormats = argv.some(arg => /^(--format|-f)$/.test(arg));
	if (!hasFormats) argv.push('-f', 'es,cjs,umd');

	// assuming {op: 'glob', pattern} for non-string args
	prog(argv.map(arg => (typeof arg === 'string' ? arg : arg.pattern)));

	return parsed;
})();

////////////////////////////////////////////////////////////////////////////////
// Get the build script from a fixtures package.json
const getBuildScript = async (fixturePath, defaultScript) => {
	let pkg = {};
	try {
		pkg = JSON.parse(
			await readFile(resolve(fixturePath, 'package.json'), 'utf8'),
		);
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}
	return (pkg && pkg.scripts && pkg.scripts.build) || defaultScript;
};
exports.getBuildScript = getBuildScript;

////////////////////////////////////////////////////////////////////////////////
// Build one of our fixture directories using jvdx's build command
const buildDirectory = async fixtureDir => {
	let fixturePath = resolve(FIXTURES_DIR, fixtureDir);
	if (fixtureDir.endsWith('-with-cwd')) {
		fixturePath = resolve(fixturePath, fixtureDir.replace('-with-cwd', ''));
	}

	// clean up
	await rimraf(resolve(`${fixturePath}/dist`));
	await rimraf(resolve(`${fixturePath}/node_modules`));
	await rimraf(resolve(`${fixturePath}/types`));
	await rimraf(resolve(`${fixturePath}/.rts2_cache_cjs`));
	await rimraf(resolve(`${fixturePath}/.rts2_cache_es`));
	await rimraf(resolve(`${fixturePath}/.rts2_cache_umd`));

	const script = await getBuildScript(fixturePath, DEFAULT_SCRIPT);
	const prevDir = process.cwd();

	process.chdir(resolve(fixturePath));

	const parsedOpts = parseScript(script);
	let { output } = await build({
		...parsedOpts,
		cwd: parsedOpts.cwd !== '.' ? parsedOpts.cwd : resolve(fixturePath),
	});
	output = output || '';

	process.chdir(prevDir);

	return output;
};
exports.buildDirectory = buildDirectory;

///////////////////////////////////

/**
 * Collects the files and folders for a directory path into an Object, subject
 * to the options supplied, and invoking optional
 * @param  {String} path
 * @param  {Object} options
 * @param  {function} onEachFile
 * @param  {function} onEachDirectory
 * @return {Object}
 */
function directoryTree(path, context = {}) {
	const name = basename(path);
	const item = { path, name };

	let stats;
	let lstat;
	try {
		stats = fs.statSync(path);
		lstat = fs.lstatSync(path);
	} catch (e) {
		return null;
	}

	if (lstat.isSymbolicLink()) {
		item.isSymbolicLink = true;
		// Initialize the symbolic links array to avoid infinite loops
		if (!context.symlinks) context = { ...context, symlinks: [] };
		// Skip if a cyclic symbolic link has been found
		if (context.symlinks.find(ino => ino === lstat.ino)) {
			return null;
		}
		context.symlinks.push(lstat.ino);
	}

	if (stats.isFile()) {
		const ext = extname(path).toLowerCase();
		item.size = stats.size;
		item.extension = ext;
		item.type = 'file';
	} else if (stats.isDirectory()) {
		let dirData = [];
		try {
			dirData = fs.readdirSync(path);
		} catch (ex) {
			if (ex.code == 'EACCES' || ex.code == 'EPERM') {
				// User does not have permissions, ignore directory
				return null;
			}
			throw ex;
		}

		item.children = dirData
			.map(child => directoryTree(join(path, child), context))
			.filter(e => !!e);
		item.size = item.children.reduce((prev, cur) => prev + cur.size, 0);
		item.type = 'directory';
	} else {
		// Or set item.size = 0 for devices, FIFO and sockets ?
		return null;
	}
	return item;
}
exports.directoryTree = directoryTree;
