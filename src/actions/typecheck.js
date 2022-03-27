const { resolveBin, parseArgs, runCMD } = require('../utils');

async function typecheck(opts) {
	const args = parseArgs(opts, {
		requiredArgs: [`--noEmit`],
	});

	await runCMD([resolveBin('tsc'), ...args]);

	return { output: '' };
}
exports.typecheck = typecheck;
