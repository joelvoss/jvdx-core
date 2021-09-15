const { resolve } = require('path');
const fs = require('fs-extra');
const stripAnsi = require('strip-ansi');
const {
	buildDirectory,
	getBuildScript,
	printTree,
	directoryTree,
} = require('../src/shared/test-utils');
const { fromRoot } = require('../src/utils');

////////////////////////////////////////////////////////////////////////////////
// Test specific variables and helper methods
const TEST_TIMEOUT = 11000;
const FIXTURES_DIR = fromRoot(`tests/__fixtures__/actions-build`);
const DEFAULT_SCRIPT = 'jvdx build';

const sleep = ms => new Promise(r => setTimeout(r, ms));

////////////////////////////////////////////////////////////////////////////////
// Test suite
describe('build fixtures', () => {
	const dirs = fs
		.readdirSync(FIXTURES_DIR)
		.filter(fixturePath =>
			fs.statSync(resolve(FIXTURES_DIR, fixturePath)).isDirectory(),
		);

	it.each(dirs)(
		'build %s with jvdx',
		async fixtureDir => {
			let fixturePath = resolve(FIXTURES_DIR, fixtureDir);
			if (fixtureDir.endsWith('-with-cwd')) {
				fixturePath = resolve(fixturePath, fixtureDir.replace('-with-cwd', ''));
			}

			await sleep(0.5);

			const output = await buildDirectory(fixtureDir);

			await sleep(0.5);

			const printedDir = printTree([directoryTree(fixturePath)]);

			expect(
				[
					`Used script: ${await getBuildScript(fixturePath, DEFAULT_SCRIPT)}`,
					'Directory tree:',
					printedDir,
					stripAnsi(output),
				].join('\n\n'),
			).toMatchSnapshot();

			const dist = resolve(`${fixturePath}/dist`);
			const files = fs.readdirSync(resolve(dist));
			expect(files.length).toMatchSnapshot();
			// we don't really care about the content of a sourcemap
			files
				.filter(
					file =>
						!/\.map$/.test(file) &&
						!fs.lstatSync(resolve(dist, file)).isDirectory(),
				)
				.sort(file => (/modern/.test(file) ? 1 : 0))
				.forEach(file => {
					expect(
						fs.readFileSync(resolve(dist, file)).toString('utf8'),
					).toMatchSnapshot();
				});

			// TypeScript declaration files
			const types = resolve(`${fixturePath}/types`);
			if (fs.existsSync(types)) {
				const declarations = fs.readdirSync(types);
				expect(declarations.length).toMatchSnapshot();
				declarations.forEach(file => {
					expect(
						fs.readFileSync(resolve(types, file)).toString('utf8'),
					).toMatchSnapshot();
				});
			}
		},
		TEST_TIMEOUT,
	);

	it('should keep shebang', () => {
		expect(
			fs
				.readFileSync(resolve(FIXTURES_DIR, 'shebang/dist/shebang.js'), 'utf8')
				.startsWith('#!'),
		).toEqual(true);
	});

	it('should keep named and default export', () => {
		const mod = require(resolve(
			FIXTURES_DIR,
			'default-named/dist/default-named.js',
		));

		expect(Object.keys(mod)).toEqual(['default', 'foo']);
	});
});
