const sade = require('sade');
const { arrify } = require('./utils');
let { version } = require('../package.json');

module.exports = handler => {
	const ENABLE_MODERN = process.env.MICROBUNDLE_MODERN !== 'false';
	const DEFAULT_FORMATS = ENABLE_MODERN ? 'modern,es,cjs,umd' : 'es,cjs,umd';

	// Define our base command. This sets certain options by default
	// The cmd handler may choose to act on those
	const cmd = type => (str, opts) => {
		if (opts == null) opts = str;

		if (type === 'build') {
			opts.entries = arrify(str || opts.entry).concat(opts._);

			if (opts.compress != null) {
				// Convert `--compress true/false/1/0` to booleans:
				if (typeof opts.compress !== 'boolean') {
					opts.compress = opts.compress !== 'false' && opts.compress !== '0';
				}
			} else {
				// the default compress value is `true` for web, `false` for Node:
				opts.compress = opts.target !== 'node';
			}
		}

		handler(type, opts);
	};

	let prog = sade('jvdx').version(version);

	prog
		.command('clean')
		.describe(
			'Cleans repository and removes `./node_modules` and `./dist`.' +
				'You can append a glob pattern to remove additional files/folders.',
		)
		.action(cmd('clean'));

	prog
		.command('lint')
		.describe('Lint your source code using `eslint` and `prettier`')
		.example('lint')
		.action(cmd('lint'));

	prog
		.command('format')
		.describe('Format your source code using `prettier`')
		.example('format')
		.action(cmd('format'));

	prog
		.command('test')
		.describe('Test your source code using `jest`')
		.example('test')
		.action(cmd('test'));

	prog
		.command('pre-commit')
		.describe('Run pre-commit tasks using `lint-staged`')
		.example('pre-commit')
		.action(cmd('pre-commit'));

	prog
		.command('build [...entries]')
		.describe(
			'Builds the assets once, it also enabled minification and sets the NODE_ENV=production environment variable',
		)
		.example('build')
		.option('--clean, -c', 'Clean output directory before building.')
		.example('build --clean')
		.option('--entry, -i', 'Entry module(s)')
		.option('--output, -o', 'Directory to place build files into')
		.option(
			'--format, -f',
			`Only build specified formats (any of ${DEFAULT_FORMATS} or iife)`,
			DEFAULT_FORMATS,
		)
		.option('--watch, -w', 'Rebuilds on any change', false)
		.option(
			'--pkg-main',
			'Outputs files analog to package.json main entries',
			true,
		)
		.option('--target', 'Specify your target environment (node or web)', 'web')
		.option('--external', `Specify external dependencies, or 'none'`)
		.option('--globals', `Specify globals dependencies, or 'none'`)
		.example('build --globals react=React,jquery=$')
		.option('--define', 'Replace constants with hard-coded values')
		.example('build --define API_KEY=1234')
		.option('--alias', `Map imports to different modules`)
		.example('build --alias react=preact')
		.option('--compress', 'Compress output using Terser', null)
		.option('--strict', 'Enforce undefined global context and add "use strict"')
		.option('--name', 'Specify name exposed in UMD builds')
		.option('--cwd', 'Use an alternative working directory', '.')
		.option('--sourcemap', 'Generate source map', true)
		.option(
			'--css-modules',
			'Turns on css-modules for all .css imports. Passing a string will override the scopeName. eg --css-modules="_[hash]"',
			null,
		)
		.example("build --no-sourcemap # don't generate sourcemaps")
		.option('--jsx', 'Enable @babel/preset-react')
		.option('--tsconfig', 'Specify the path to a custom tsconfig.json')
		.example('build --tsconfig tsconfig.build.json')
		.action(cmd('build'));

	// prog
	// 	.command('watch [...entries]')
	// 	.describe('Rebuilds on any change')
	// 	.action(cmd('watch'));

	// Parse argv; add extra aliases
	return argv =>
		prog.parse(argv, {
			alias: {
				o: ['output', 'd'],
				i: ['entry', 'entries', 'e'],
				w: ['watch'],
			},
		});
};
