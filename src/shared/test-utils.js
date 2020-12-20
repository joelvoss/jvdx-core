const { resolve } = require('path');
const shellQuote = require('shell-quote');
const { promisify } = require('es6-promisify');
const _rimraf = require('rimraf');
const { fromRoot, readFile } = require('../utils');
const createProg = require('../prog');
const { build } = require('../actions/build');

const rimraf = promisify(_rimraf);

///////////////////////////////////////////////////////////////////////////////

const FIXTURES_DIR = fromRoot(`tests/__fixtures__/build`);
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
