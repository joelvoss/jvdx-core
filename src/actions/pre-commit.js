const path = require('path');
const readPkgUp = require('read-pkg-up');
const {
	resolveBin,
	hasFile,
	runCMD,
	printErr,
	arrify,
	parseArgs,
} = require('../utils');
const { packageJson } = readPkgUp.sync({ normalize: false });

const here = (...p) => path.join(__dirname, ...p);
const hereRelative = (...p) => here(...p).replace(process.cwd(), '.');
const hasPkgProp = props =>
	arrify(props).some(
		prop => packageJson != null && hasOwnProperty.call(packageJson, prop),
	);

async function preCommit(opts) {
	const useBuiltInConfig =
		!opts.config &&
		!hasFile('.lintstagedrc') &&
		!hasFile('lint-staged.config.js') &&
		!hasPkgProp('lint-staged');

	const args = parseArgs(opts, {
		requiredArgs: useBuiltInConfig
			? ['--config', hereRelative('../shared/lint-staged.js')]
			: [],
	});
	await runCMD([resolveBin('lint-staged'), ...args]).catch(err => {
		if (err) {
			printErr(err);
			process.exit();
		}
	});
}
exports.preCommit = preCommit;
