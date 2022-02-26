describe('print, printWarn, printErr', () => {
	const spyConsoleLog = jest.spyOn(console, 'log').mockImplementation();
	const spyConsoleError = jest.spyOn(console, 'error').mockImplementation();
	afterEach(() => {
		spyConsoleLog.mockRestore();
		spyConsoleError.mockRestore();
	});
	const { print, printWarn, printErr } = require('../src/utils');

	it('should print formatted log messages', () => {
		print('Log message');
		printWarn('Warn message');
		printErr('Err message');

		expect(spyConsoleLog).toHaveBeenCalledTimes(2);
		expect(
			spyConsoleLog.mock.calls[0][0]
				.replace('\x1B[36m', '')
				.replace('\x1B[39m', ''),
		).toEqual('info - Log message');
		expect(
			spyConsoleLog.mock.calls[1][0]
				.replace('\x1B[33m', '')
				.replace('\x1B[39m', ''),
		).toEqual('warn - Warn message');

		expect(spyConsoleError).toHaveBeenCalledTimes(1);
		expect(
			spyConsoleError.mock.calls[0][0]
				.replace('\x1B[31m', '')
				.replace('\x1B[39m', ''),
		).toEqual('err  - Err message');
	});
});

describe('appDir', () => {
	const { appDir } = require('../src/utils');

	it('should return the root directory', () => {
		expect(appDir()).toContain('@jvdx/core');
	});
});

describe('fromRoot', () => {
	const { fromRoot } = require('../src/utils');

	it('should return path relative to the root directory', () => {
		expect(fromRoot('./sub-dir')).toContain('@jvdx/core/sub-dir');
		expect(fromRoot('./sub-dir/another-dir')).toContain(
			'@jvdx/core/sub-dir/another-dir',
		);
		expect(fromRoot('../sub-dir')).toContain('@jvdx/sub-dir');
	});
});

describe('isDir', () => {
	const { fromRoot, isDir } = require('../src/utils');
	const FIXTURES_DIR = fromRoot(`tests/__fixtures__/actions-build`);

	it(`should return a boolean indicating if its a directory or not`, async () => {
		const dir = await isDir(`${FIXTURES_DIR}/basic`);
		const notADir = await isDir(`${FIXTURES_DIR}/basic/package.json`);
		expect(dir).toBe(true);
		expect(notADir).toBe(false);
	});
});

describe('isFile', () => {
	const { fromRoot, isFile } = require('../src/utils');
	const FIXTURES_DIR = fromRoot(`tests/__fixtures__/actions-build`);

	it(`should return a boolean indicating if it's a file or not`, async () => {
		const file = await isFile(`${FIXTURES_DIR}/basic/package.json`);
		const notAFile = await isFile(`${FIXTURES_DIR}/basic`);
		expect(file).toBe(true);
		expect(notAFile).toBe(false);
	});
});

describe('removePkgScope', () => {
	const { removePkgScope } = require('../src/utils');

	it('should remove the scope from a package name', () => {
		expect(removePkgScope('path/to/@jvdx/core')).toBe('path/to/core');
	});
});

describe('resolveBin', () => {
	jest.mock('which', () => ({ sync: jest.fn(() => {}) }));

	let whichSyncMock;
	beforeEach(() => {
		jest.resetModules();
		whichSyncMock = require('which').sync;
	});

	it(`should resolve to the full path when it's not in $PATH`, () => {
		const { resolveBin } = require('../src/utils');
		expect(resolveBin('eslint')).toBe(
			require.resolve('eslint/bin/eslint').replace(process.cwd(), '.'),
		);
	});

	it(`should resolve to the binary if it's in $PATH`, () => {
		const { resolveBin } = require('../src/utils');
		whichSyncMock.mockImplementationOnce(() =>
			require.resolve('eslint/bin/eslint').replace(process.cwd(), '.'),
		);
		expect(resolveBin('eslint')).toBe('eslint');
		expect(whichSyncMock).toHaveBeenCalledTimes(1);
		expect(whichSyncMock).toHaveBeenCalledWith('eslint');
	});
});

describe('parseArgs', () => {
	const { parseArgs } = require('../src/utils');

	let opts = {
		_: ['posArg'],
		opt1: true,
		opt2: false,
		opt3: 'test',
	};

	it('should parse a sade opts object', () => {
		expect(parseArgs(opts)).toEqual(['--opt1', '--no-opt2', '--opt3', 'test']);
	});

	it('should filter out specific options', () => {
		expect(parseArgs(opts, { keysToFilter: 'opt3' })).toEqual([
			'--opt1',
			'--no-opt2',
		]);
		expect(parseArgs(opts, { keysToFilter: ['opt1', 'opt3'] })).toEqual([
			'--no-opt2',
		]);
	});

	it('should append required options', () => {
		expect(parseArgs(opts, { requiredArgs: '--opt4' })).toEqual([
			'--opt1',
			'--no-opt2',
			'--opt3',
			'test',
			'--opt4',
		]);
		expect(parseArgs(opts, { requiredArgs: ['--opt4', 'required'] })).toEqual([
			'--opt1',
			'--no-opt2',
			'--opt3',
			'test',
			'--opt4',
			'required',
		]);
		expect(
			parseArgs(opts, { requiredArgs: ['--opt4', 'required arg'] }),
		).toEqual([
			'--opt1',
			'--no-opt2',
			'--opt3',
			'test',
			'--opt4',
			'required',
			'arg',
		]);
	});

	it('should set default arguments', () => {
		opts = { _: [] };
		expect(parseArgs(opts, { defaultArgs: '--def1' })).toEqual(['--def1']);
		expect(parseArgs(opts, { defaultArgs: ['--def1', 'def2'] })).toEqual([
			'--def1',
			'def2',
		]);
		expect(
			parseArgs(opts, { defaultArgs: ['--def1', 'def2 witharg'] }),
		).toEqual(['--def1', 'def2', 'witharg']);
	});
});

describe('arrify', () => {
	const { arrify } = require('../src/utils');

	it('should return an array if the given value is null or undefined', () => {
		expect(arrify(null)).toEqual([]);
		expect(arrify(undefined)).toEqual([]);
	});

	it('should do nothing if an array is given', () => {
		expect(arrify(['array'])).toEqual(['array']);
	});

	it('should wrap a string in an array', () => {
		expect(arrify('array')).toEqual(['array']);
	});

	it('should convert a Map into an array', () => {
		expect(
			arrify(
				new Map([
					[1, 2],
					['a', 'b'],
				]),
			),
		).toEqual([
			[1, 2],
			['a', 'b'],
		]);
	});

	it('should convert a Set into an array', () => {
		expect(arrify(new Set([1, 2]))).toEqual([1, 2]);
	});

	it('should wrap a value in an array', () => {
		expect(arrify(1)).toEqual([1]);
	});
});

describe('jsOrTs', () => {
	const { fromRoot, jsOrTs } = require('../src/utils');
	const FIXTURES_DIR = fromRoot(`tests/__fixtures__/actions-build`);

	it(`should return the absolute path with the correct extension`, async () => {
		const jsFile = await jsOrTs(
			process.cwd(),
			`${FIXTURES_DIR}/basic/src/index`,
		);
		const tsFile = await jsOrTs(
			process.cwd(),
			`${FIXTURES_DIR}/basic-ts/src/index`,
		);
		expect(jsFile).toContain('.js');
		expect(tsFile).toContain('.ts');
	});
});

describe('getTime', () => {
	const { getTime } = require('../src/utils');
	it(`should return formatted hrtimes`, () => {
		const mockHrTime = [67917, 929916193];
		expect(getTime(mockHrTime)).toEqual({
			min: 1131.9654986032167,
			ms: 67917929.916193,
			ns: 67917929916193,
			s: 67917.92,
		});
	});
});

describe('toReplacementExpression', () => {
	const { toReplacementExpression } = require('../src/utils');

	it(`should return a string literal`, () => {
		expect(toReplacementExpression(`other`, 'A')).toEqual(['"other"', 'A']);
	});

	it(`--define A="1",B='true' produces string`, () => {
		expect(toReplacementExpression(`"1"`, 'A')).toEqual(['"1"', 'A']);
		expect(toReplacementExpression(`'true'`, 'A')).toEqual(['"true"', 'A']);
	});

	it(`--define A=1,B=true produces int/boolean literal`, () => {
		expect(toReplacementExpression(`1`, 'A')).toEqual(['1', 'A']);
		expect(toReplacementExpression(`true`, 'A')).toEqual(['true', 'A']);
	});

	it(`--define @assign=Object.assign replaces expressions with expressions`, () => {
		expect(toReplacementExpression(`Object.assign`, '@assign')).toEqual([
			'Object.assign',
			'assign',
		]);
	});
});

describe('parseMappingArgument', () => {
	const { parseMappingArgument } = require('../src/utils');

	it('should parse "$=jQuery,React=react" values into key-value object pairs', () => {
		expect(parseMappingArgument('$=jQuery,React=react')).toEqual({
			$: 'jQuery',
			React: 'react',
		});
	});
});

describe('parseAliasArgument', () => {
	const { parseAliasArgument } = require('../src/utils');

	it('should parse "$=jQuery,React=react" values into find and replacement hashmap', () => {
		expect(parseAliasArgument('$=jQuery,React=react')).toEqual([
			{ find: '$', replacement: 'jQuery' },
			{ find: 'React', replacement: 'react' },
		]);
	});
});

describe('isTruthy', () => {
	const { isTruthy } = require('../src/utils');

	it('should test if a given object is truthy', () => {
		expect(isTruthy(null)).toEqual(false);
		expect(isTruthy({})).toEqual(false);
		expect(isTruthy({ key: 'value ' })).toEqual(true);
	});
});

describe('resolveFrom', () => {
	const { resolveFrom } = require('../src/utils');

	it('should throw on invalid arguments', () => {
		expect(() => resolveFrom(1, './fixture')).toThrowError(/got `number`/);
		expect(() => resolveFrom('tests/__fixtures__/resolveFrom')).toThrowError(
			/got `undefined`/,
		);
	});

	it('should resolve modules', () => {
		expect(resolveFrom('tests/__fixtures__/resolveFrom', './fixture')).toMatch(
			/__fixtures__\/resolveFrom\/fixture\.js$/,
		);

		const resolveFromfixture = resolveFrom.bind(
			null,
			'tests/__fixtures__/resolveFrom',
		);
		expect(resolveFromfixture('./fixture')).toMatch(
			/__fixtures__\/resolveFrom\/fixture\.js$/,
		);
	});

	it('should resolve symlink targets', () => {
		expect(
			resolveFrom(
				'tests/__fixtures__/resolveFrom/fixture-for-symlinks/symlink-target',
				'foo',
			),
		).toBeTruthy();
	});
});

describe('escapeStringRegexp', () => {
	const { escapeStringRegexp } = require('../src/utils');

	it('should escape a regex', () => {
		expect(escapeStringRegexp('\\ ^ $ * + ? . ( ) | { } [ ]')).toEqual(
			'\\\\ \\^ \\$ \\* \\+ \\? \\. \\( \\) \\| \\{ \\} \\[ \\]',
		);
	});
	it('should escape `-` in a way compatible with PCRE', () => {
		expect(escapeStringRegexp('foo - bar')).toEqual('foo \\x2d bar');
	});
	it('should escape `-` in a way compatible with the Unicode flag', () => {
		expect('-').toMatch(new RegExp(escapeStringRegexp('-'), 'u'));
	});
});

describe('prettyBytes', () => {
	const { prettyBytes } = require('../src/utils');

	it('should convert bytes to human readable strings', () => {
		expect(prettyBytes(0)).toBe('0 B');
		expect(prettyBytes(0.4)).toBe('0.4 B');
		expect(prettyBytes(0.7)).toBe('0.7 B');
		expect(prettyBytes(10)).toBe('10 B');
		expect(prettyBytes(10.1)).toBe('10.1 B');
		expect(prettyBytes(999)).toBe('999 B');
		expect(prettyBytes(1001)).toBe('1 kB');
		expect(prettyBytes(1e16)).toBe('10 PB');
		expect(prettyBytes(1e30)).toBe('1,000,000 YB');
	});

	it('should convert negative bytes to human readable strings', () => {
		expect(prettyBytes(-0.4)).toBe('-0.4 B');
		expect(prettyBytes(-0.7)).toBe('-0.7 B');
		expect(prettyBytes(-10.1)).toBe('-10.1 B');
		expect(prettyBytes(-999)).toBe('-999 B');
		expect(prettyBytes(-1001)).toBe('-1 kB');
	});
});
