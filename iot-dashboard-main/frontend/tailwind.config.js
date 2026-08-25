/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Control-room panel surfaces
        panel: {
          DEFAULT: '#121826',
          light: '#F7F8FA',
          border: '#232B3D',
          borderLight: '#DDE2EA',
        },
        base: {
          DEFAULT: '#0A0E14',
          light: '#EEF1F5',
        },
        // Signal / accent colors (instrument-panel semantics)
        signal: {
          cyan: '#1FD1C1',      // live data / normal flow
          amber: '#F5A623',     // warnings / street light
          red: '#EF4444',       // leak / dry-tank / critical
          blue: '#4C7EFF',      // operator actions
          steel: '#3B4A66',     // secondary text / dividers
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0,0,0,0.36)',
        glow: '0 0 24px rgba(31,209,193,0.25)',
        glowRed: '0 0 24px rgba(239,68,68,0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        pulseBorder: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.5)' },
          '50%': { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
        },
      },
      animation: {
        pulseBorder: 'pulseBorder 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
