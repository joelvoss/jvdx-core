#!/usr/bin/env node

const { clean } = require('./actions/clean');
const { lint } = require('./actions/lint');
const { format } = require('./actions/format');
const { test } = require('./actions/test');
const { build } = require('./actions/build');

const prog = require('./prog');
const { print, logError } = require('./utils');

const run = (type, opts) => {
	const unwrap = promise =>
		promise
			.then(({ output } = {}) => {
				if (output != null && output.length > 0) print(output);
				if (!opts.watch) process.exit(0);
			})
			.catch(err => {
				process.exitCode = (err.code && typeof err.code === 'number') || 1;
				logError(err, { printLoc: true, printStack: true });
				process.exit();
			});

	switch (type) {
		case 'clean':
			print('Cleaning directories');
			return unwrap(clean(opts));

		case 'lint':
			print('Linting sources');
			return unwrap(lint(opts));

		case 'format':
			print('Formatting sources');
			return unwrap(format(opts));

		case 'test':
			print('Running unit tests');
			return unwrap(test(opts));

		case 'build':
		default:
			print('Creating an optimized production build');
			return unwrap(build(opts));
	}
};

prog(run)(process.argv);
