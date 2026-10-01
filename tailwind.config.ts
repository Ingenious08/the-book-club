import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        mute: 'var(--mute)',
        line: 'var(--line)',
        leaf: 'var(--leaf)',
        'leaf-soft': 'var(--leaf-soft)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        serif: ["'Instrument Serif'", "'New York'", 'Georgia', 'serif'],
        sans: ['Geist', "'SF Pro Text'", 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
