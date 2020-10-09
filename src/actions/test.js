const { resolveBin, parseArgs, runCMD, printErr } = require('../utils');

async function test(opts) {
	// process.env.BABEL_ENV = 'test';
	// process.env.NODE_ENV = 'test';

	const jestConfig = {
		testEnvironment: 'node',
		testURL: 'http://localhost',
		watchPlugins: [
			require.resolve('jest-watch-typeahead/filename'),
			require.resolve('jest-watch-typeahead/testname'),
		],
		transform: {
			'^.+\\.jsx?$': require.resolve('babel-jest'),
			'^.+\\.(ts|tsx)$': require.resolve('ts-jest/dist'),
		},
	};

	const args = parseArgs(opts, {
		requiredArgs: ['--config', JSON.stringify(jestConfig)],
	});

	await runCMD([resolveBin('jest'), ...args]).catch(err => {
		if (err) {
			printErr(err);
			process.exit();
		}
	});

	return { output: '' };
}
exports.test = test;
