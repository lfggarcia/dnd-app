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
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				card: 'var(--card)',
				'card-foreground': 'var(--card-foreground)',
				popover: 'var(--popover)',
				'popover-foreground': 'var(--popover-foreground)',
				primary: 'var(--primary)',
				'primary-foreground': 'var(--primary-foreground)',
				secondary: 'var(--secondary)',
				'secondary-foreground': 'var(--secondary-foreground)',
				muted: 'var(--muted)',
				'muted-foreground': 'var(--muted-foreground)',
				accent: 'var(--accent)',
				'accent-foreground': 'var(--accent-foreground)',
				destructive: 'var(--destructive)',
				'destructive-foreground': 'var(--destructive-foreground)',
				border: 'var(--border)',
				input: 'var(--input)',
				'input-background': 'var(--input-background)',
				'switch-background': 'var(--switch-background)',
				ring: 'var(--ring)',
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
