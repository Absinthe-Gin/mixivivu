import type { Config } from 'tailwindcss';

// Every value maps to a CSS custom property declared in src/styles/tokens.css,
// so the design tokens have a single source of truth.
const gray = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, `var(--gray-${s})`]),
);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '481px',
      md: '769px',
      lg: '1025px',
      xl: '1281px',
    },
    extend: {
      fontFamily: { sans: ['Archivo', 'sans-serif'] },
      colors: {
        primary: { light: 'var(--primary-light)', DEFAULT: 'var(--primary-base)', dark: 'var(--primary-dark)' },
        gray,
        success: { light: 'var(--success-light)', DEFAULT: 'var(--success-base)', dark: 'var(--success-dark)' },
        error: { light: 'var(--error-light)', DEFAULT: 'var(--error-base)', dark: 'var(--error-dark)' },
        warning: { light: 'var(--warning-light)', DEFAULT: 'var(--warning-base)', dark: 'var(--warning-dark)' },
        info: { light: 'var(--info-light)', DEFAULT: 'var(--info-base)', dark: 'var(--info-dark)' },
      },
      maxWidth: { container: 'var(--container-max)' },
      borderRadius: { card: 'var(--radius-card)', image: 'var(--radius-image)', input: 'var(--radius-input)' },
      boxShadow: { xs: 'var(--shadow-xs)', sm: 'var(--shadow-sm)', image: 'var(--shadow-image)', dropdown: 'var(--shadow-dropdown)' },
      zIndex: { header: 'var(--z-header)', dropdown: 'var(--z-dropdown)', modal: 'var(--z-modal)', toast: 'var(--z-toast)' },
      height: { header: 'var(--header-height)' },
    },
  },
  plugins: [],
} satisfies Config;
