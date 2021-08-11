const { dim, underline, bold } = require('kleur');
const { resolveBin, parseArgs, runCMD, stopwatch } = require('../utils');

async function lint(opts) {
	const stop = stopwatch();

	const hasPositionArgs = Boolean(opts._.length);
	const filesToApply = hasPositionArgs ? opts._ : ['./src'];

	const args = parseArgs(opts, {
		defaultArgs: ['--ext', '.js,.jsx,.ts,.tsx'],
	});

	await runCMD([resolveBin('eslint'), ...filesToApply, ...args]);

	const { s } = stop();
	const output =
		`Linted in ${bold(`${s}s`)}\n` +
		`\n` +
		`${underline('Glob(s) processed')}\n` +
		`${dim(filesToApply)}\n`;

	return { output };
}
exports.lint = lint;
