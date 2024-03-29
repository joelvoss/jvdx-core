const { dim, underline, bold } = require('kleur');
const { resolveBin, parseArgs, runCMD, stopwatch } = require('../utils');

async function format(opts) {
	const stop = stopwatch();

	const hasPositionArgs = Boolean(opts._.length);
	const filesToApply = hasPositionArgs
		? opts._
		: ['./src/**/*.+(js|json|less|css|ts|tsx|md)'];

	const args = parseArgs(opts, {
		defaultArgs: ['--write', '--log-level silent'],
	});

	await runCMD([resolveBin('prettier'), ...args, ...filesToApply]);

	const { s } = stop();
	const output =
		`Formatted in ${bold(`${s}s`)}\n` +
		`\n` +
		`${underline('Glob(s) processed')}\n` +
		`${dim(filesToApply)}\n`;

	return { output };
}
exports.format = format;
