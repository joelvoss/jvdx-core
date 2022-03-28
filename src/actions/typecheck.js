const { bold } = require('kleur');
const { resolveBin, parseArgs, runCMD, stopwatch } = require('../utils');

async function typecheck(opts) {
	const stop = stopwatch();

	const args = parseArgs(opts, {
		requiredArgs: [`--noEmit`, `--incremental false`],
	});

	await runCMD([resolveBin('tsc'), ...args]);

	const { s } = stop();
	const output = `Typechecked in ${bold(`${s}s`)}\n`;

	return { output };
}
exports.typecheck = typecheck;
