// Normalize terser options from jvdx's relaxed json format
// (mutates argument in-place)
function normalizeMinifyOptions(minifyOptions) {
	// Ignore normalization if "mangle" is a boolean:
	if (typeof minifyOptions.mangle === 'boolean') return;

	const mangle = minifyOptions.mangle || (minifyOptions.mangle = {});
	let properties = mangle.properties;

	// Allow top-level "properties" key to override mangle.properties
	// (including {properties:false})
	if (minifyOptions.properties != null) {
		properties = mangle.properties =
			minifyOptions.properties &&
			Object.assign(properties, minifyOptions.properties);
	}

	// Allow previous format ({ mangle:{regex:'^_',reserved:[]} })
	if (minifyOptions.regex || minifyOptions.reserved) {
		if (!properties) properties = mangle.properties = {};
		properties.regex = properties.regex || minifyOptions.regex;
		properties.reserved = properties.reserved || minifyOptions.reserved;
	}

	if (properties) {
		if (properties.regex) properties.regex = new RegExp(properties.regex);
		properties.reserved = [].concat(properties.reserved || []);
	}
}
exports.normalizeMinifyOptions = normalizeMinifyOptions;
