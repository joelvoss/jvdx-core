const { promisify } = require('es6-promisify');
const _rimraf = require('rimraf');
const { dim, underline, bold } = require('kleur');
const { stopwatch, printErr, fromRoot } = require('../utils');

const rimraf = promisify(_rimraf);

async function clean(opts) {
	const stop = stopwatch();

	const hasPositionArgs = Boolean(opts._.length);
	const filesToApply = hasPositionArgs ? opts._ : ['./node_modules', './dist'];

	for (let f of filesToApply) {
		await rimraf(fromRoot(f)).catch(_ => {
			printErr(`Error cleaning ${f}\n`);
		});
	}

	const { s } = stop();
	const output =
		`Cleaned in ${bold(`${s}s`)}\n` +
		`\n` +
		`${underline('Directories removed')}\n` +
		`${dim(filesToApply.join('\n'))}\n`;

	return { output };
}
exports.clean = clean;
