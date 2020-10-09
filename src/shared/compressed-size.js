const { green, red, yellow } = require('kleur');
const gzipSize = require('gzip-size');
const { default: brotliSize } = require('brotli-size');
const prettyBytes = require('pretty-bytes');

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
