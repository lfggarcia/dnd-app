const { platformSelect } = require("nativewind/theme");

module.exports = {
	content: [
		'./App.{js,jsx,ts,tsx}',
		'./src/**/*.{js,jsx,ts,tsx}',
	],
	presets: [require('nativewind/preset')],
	theme: {
		extend: {
			fontFamily: {
				robotomono: ["RobotoMono"],
				system: platformSelect({
					ios: "RobotoMono",
					android: "RobotoMono",
					default: "RobotoMono",
				}),
			},
		},
	},
	plugins: [],
};
