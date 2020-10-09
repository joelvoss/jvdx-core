const { dim, underline, bold } = require('kleur');
const { runCMD, stopwatch, printErr } = require('../utils');

async function clean(opts) {
	const stop = stopwatch();

	const hasPositionArgs = Boolean(opts._.length);
	const filesToApply = hasPositionArgs ? opts._ : ['./node_modules', './dist'];

	await runCMD(['rm', '-rf', ...filesToApply]).catch(_ => {
		printErr(`Error cleaning repository\n`);
		process.exit();
	});

	const { s } = stop();
	const output =
		`Cleaned in ${bold(`${s}s`)}\n` +
		`\n` +
		`${underline('Directories removed')}\n` +
		`${dim(filesToApply.join('\n'))}\n`;

	return { output };
}
exports.clean = clean;
