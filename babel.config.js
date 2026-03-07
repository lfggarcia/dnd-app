module.exports = {
	presets: [
		['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }],
		'nativewind/babel',
	],
	plugins: [
		['module:react-native-dotenv', {
			moduleName: '@env',
			path: '.env',
			blacklist: null,
			whitelist: null,
			safe: false,
			allowUndefined: true,
		}],
		'react-native-reanimated/plugin',
	],
};
