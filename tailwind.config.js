/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        axis: {
          bg: '#0a0a0a',
          card: '#111111',
          border: '#1f1f1f',
          accent: '#C8F55A',
          danger: '#FF4444',
          muted: '#555555',
        },
      },
      fontFamily: {
        syne: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};
