const { isTruthy, print } = require('../utils');
const { createBabelInputPluginFactory } = require('@rollup/plugin-babel');
const merge = require('lodash.merge');

////////////////////////////////////////////////////////////////////////////////

const mergeConfigItems = (babel, type, ...configItemsToMerge) => {
	const mergedItems = [];

	configItemsToMerge.forEach(configItemToMerge => {
		configItemToMerge.forEach(item => {
			const itemToMergeWithIndex = mergedItems.findIndex(
				mergedItem =>
					(mergedItem.name || mergedItem.file.resolved) ===
					(item.name || item.file.resolved),
			);

			if (itemToMergeWithIndex === -1) {
				mergedItems.push(item);
				return;
			}

			mergedItems[itemToMergeWithIndex] = babel.createConfigItem(
				[
					mergedItems[itemToMergeWithIndex].file.resolved,
					merge(mergedItems[itemToMergeWithIndex].options, item.options),
				],
				{
					type,
				},
			);
		});
	});

	return mergedItems;
};

////////////////////////////////////////////////////////////////////////////////

const createConfigItems = (babel, type, items) =>
	items.map(item => {
		let { name, value, ...options } = item;
		value = value || [require.resolve(name), options];
		return babel.createConfigItem(value, { type });
	});

////////////////////////////////////////////////////////////////////////////////

module.exports = () => {
	const configs = new Set();

	return createBabelInputPluginFactory(babelCore => ({
		// Passed the plugin options.
		options({ custom: customOptions, ...pluginOptions }) {
			return {
				// Pull out any custom options that the plugin might have.
				//	-> defines, modern, compress, targets, typescript, jsx
				customOptions,

				// Pass the options back with the two custom options removed.
				pluginOptions,
			};
		},

		config(cfg, { customOptions }) {
			const babelOptions = cfg.options || {};

			babelOptions.caller.isModern = customOptions.modern;
			babelOptions.caller.isTypescript = customOptions.typescript;
			babelOptions.caller.hasJsxRuntime = customOptions.jsx;

			const defaultPlugins = createConfigItems(
				babelCore,
				'plugin',
				[
					isTruthy(customOptions.defines) && {
						name: 'babel-plugin-transform-replace-expressions',
						replace: customOptions.defines,
					},
				].filter(Boolean),
			);

			if (cfg.hasFilesystemConfig()) {
				for (const file of [cfg.babelrc, cfg.config]) {
					if (file && !configs.has(file)) {
						configs.add(file);
						const filePathRelative = file.replace(process.cwd(), '.');
						print(
							`Using external babel configuration from ${filePathRelative}`,
						);
					}
				}
			} else {
				// Add our default preset if the no "babelrc" found.
				babelOptions.presets = createConfigItems(babelCore, 'preset', [
					{
						name: '@jvdx/babel-preset',
						'preset-env': {
							targets: customOptions.modern
								? { esmodules: true }
								: customOptions.targets || null,
						},
					},
				]);
			}

			// Merge babelrc & our plugins together
			babelOptions.plugins = mergeConfigItems(
				babelCore,
				'plugin',
				defaultPlugins,
				babelOptions.plugins || [],
			);

			if (customOptions.compress) {
				babelOptions.generatorOpts = {
					minified: true,
					compact: true,
					shouldPrintComment: comment => /[@#]__PURE__/.test(comment),
				};
			}
			return babelOptions;
		},
	}));
};
