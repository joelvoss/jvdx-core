const { resolveBin, parseArgs, runCMD } = require('../utils');

async function test(opts) {
	const jestConfig = {
		preset: '@jvdx/jest-preset',
	};

	const args = parseArgs(opts, {
		requiredArgs: ['--config', JSON.stringify(jestConfig)],
	});

	await runCMD([resolveBin('jest'), ...args]);

	return { output: '' };
}
exports.test = test;
