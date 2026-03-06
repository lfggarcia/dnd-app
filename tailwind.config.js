const { platformSelect } = require("nativewind/theme");

module.exports = {
	content: [
		'./App.{js,jsx,ts,tsx}',
		'./src/**/*.{js,jsx,ts,tsx}',
	],
	presets: [require('nativewind/preset')],
	theme: {
		extend: {
			colors: {
				background: 'rgb(10 14 10 / <alpha-value>)',
				foreground: 'rgb(0 255 65 / <alpha-value>)',
				card: 'rgb(10 14 10 / <alpha-value>)',
				'card-foreground': 'rgb(0 255 65 / <alpha-value>)',
				popover: 'rgb(10 14 10 / <alpha-value>)',
				'popover-foreground': 'rgb(0 255 65 / <alpha-value>)',
				primary: 'rgb(0 255 65 / <alpha-value>)',
				'primary-foreground': 'rgb(10 14 10 / <alpha-value>)',
				secondary: 'rgb(255 176 0 / <alpha-value>)',
				'secondary-foreground': 'rgb(10 14 10 / <alpha-value>)',
				muted: 'rgb(26 46 26 / <alpha-value>)',
				'muted-foreground': 'rgb(0 255 65 / 0.5)',
				accent: 'rgb(0 229 255 / <alpha-value>)',
				'accent-foreground': 'rgb(10 14 10 / <alpha-value>)',
				destructive: 'rgb(255 62 62 / <alpha-value>)',
				'destructive-foreground': 'rgb(10 14 10 / <alpha-value>)',
				border: 'rgb(0 255 65 / <alpha-value>)',
				input: 'transparent',
				'input-background': 'rgb(15 20 15 / <alpha-value>)',
				'switch-background': 'rgb(26 46 26 / <alpha-value>)',
				ring: 'rgb(0 255 65 / <alpha-value>)',
			},
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
