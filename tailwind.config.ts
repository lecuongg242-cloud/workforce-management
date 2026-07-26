import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(83 58 253 / <alpha-value>)',
        'primary-deep': 'rgb(68 52 212 / <alpha-value>)',
        'primary-pressed': 'rgb(46 43 140 / <alpha-value>)',
        'primary-soft': 'rgb(102 94 253 / <alpha-value>)',
        'primary-subdued': 'rgb(185 185 249 / <alpha-value>)',
        'brand-dark': 'rgb(28 30 84 / <alpha-value>)',
        ink: 'rgb(13 37 61 / <alpha-value>)',
        'ink-secondary': 'rgb(39 57 81 / <alpha-value>)',
        'ink-muted': 'rgb(100 116 141 / <alpha-value>)',
        canvas: 'rgb(255 255 255 / <alpha-value>)',
        'canvas-soft': 'rgb(246 249 252 / <alpha-value>)',
        'canvas-cream': 'rgb(245 233 212 / <alpha-value>)',
        border: 'rgb(227 232 238 / <alpha-value>)',
        'input-border': 'rgb(168 195 222 / <alpha-value>)',
        ruby: 'rgb(234 34 97 / <alpha-value>)',
        magenta: 'rgb(249 107 238 / <alpha-value>)',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      spacing: {
        xxs: '2px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
        huge: '64px',
      },
      boxShadow: {
        sm: 'rgba(0, 55, 112, 0.08) 0 1px 3px',
        md: 'rgba(0, 55, 112, 0.08) 0 8px 24px, rgba(0, 55, 112, 0.04) 0 2px 6px',
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
      },
    },
  },
  plugins: [],
}

export default config
