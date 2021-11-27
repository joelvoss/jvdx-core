const { green, red, yellow } = require('kleur');
const prettyBytes = require('pretty-bytes');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

async function gzipSize(input, options = {}) {
	if (!input) return 0;
	const data = await gzip(input, { level: 9, ...options });
	return data.length;
}

async function brotliSize(input, options = {}) {
	if (!input) return 0;
	const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
	const data = await brotliCompress(buffer, {
		params: {
			[zlib.constants.BROTLI_PARAM_MODE]:
				options.mode != null
					? options.mode
					: zlib.constants.BROTLI_DEFAULT_MODE,
			[zlib.constants.BROTLI_PARAM_QUALITY]:
				options.quality != null
					? options.quality
					: zlib.constants.BROTLI_MAX_QUALITY,
			[zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer ? buffer.byteLength : 0,
		},
	});
	return data.byteLength;
}

function formatSize(size, filename, type = '', onlySize) {
	const pretty = size < 5000 ? `${size} B` : prettyBytes(size);
	const color = size < 75000 ? green : size > 175000 ? red : yellow;
	return onlySize
		? `${type}: ${color(pretty)}`
		: `${filename}${type} (${color(pretty)})`;
}

async function getSizeInfo(code, filename) {
	const [gzip, brotli] = await Promise.all([
		gzipSize(code).catch(() => null),
		brotliSize(code).catch(() => null),
	]);

	let out = {
		base: formatSize(code.length, filename),
		gzip: gzip ? formatSize(gzip, filename, 'gzip', true) : null,
		brotli: brotli ? formatSize(brotli, filename, 'brotli', true) : null,
	};

	return out;
}
exports.getSizeInfo = getSizeInfo;
