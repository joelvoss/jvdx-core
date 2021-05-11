const sade = require('sade');
let { version } = require('../package.json');

module.exports = handler => {
	const ENABLE_MODERN = process.env.MICROBUNDLE_MODERN !== 'false';
	const DEFAULT_FORMATS = ENABLE_MODERN ? 'modern,es,cjs,umd' : 'es,cjs,umd';

	// Define our base command. This normalizes positional arguments.
	// The cmd handler may choose to act on those
	const cmd =
		type =>
		(...args) => {
			const opts = args[args.length - 1];
			const pos = args.slice(0, args.length - 1).filter(Boolean);

			const posArgs = pos.concat(opts._);
			opts._ = posArgs.length !== 0 ? [...new Set(posArgs)] : [];

			handler(type, opts);
		};

	let prog = sade('jvdx').version(version);

	prog
		.command('lint [...files|dir|glob]')
		.describe(
			'Statically analyzes your code using ESLint.' +
				`Note: We support ESLint's cli flags.`,
		)
		.example('lint')
		.action(cmd('lint'));

	prog
		.command('format [...files|dir|glob]')
		.describe(
			'Formats your code in-place using prettier.' +
				`Note: We support prettiers's cli flags.`,
		)
		.example('format')
		.action(cmd('format'));

	prog
		.command('clean [...files|dir|glob]')
		.describe(
			'Cleans repository and removes `./node_modules` and `./dist`.' +
				'You can append a glob pattern to remove your own set of files/folders.',
		)
		.example('clean')
		.action(cmd('clean'));

	prog
		.command('test')
		.describe(
			`Runs your test suite using Jest. Note: We support Jest's cli flags.`,
		)
		.example('test')
		.action(cmd('test'));

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
		.option(
			'--define',
			'Replace constants with hard-coded values (use @key=exp to replace an expression)',
		)
		.example('build --define API_KEY=1234')
		.option('--alias', `Map imports to different modules`)
		.example('build --alias react=preact')
		.option('--compress', 'Compress output using Terser', null)
		.option('--strict', 'Enforce undefined global context and add "use strict"')
		.option('--name', 'Specify name exposed in UMD builds')
		.option('--cwd', 'Use an alternative working directory', '.')
		.option('--sourcemap', 'Generate source map')
		.option(
			'--generate-types',
			'Generate type definitions (even for non-TS libs)',
		)
		.option('--css', 'Where to output CSS: "inline" or "external"', 'external')
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
