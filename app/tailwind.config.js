/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#08080c',
          surface: 'rgba(255,255,255,0.03)',
          border: 'rgba(255,255,255,0.06)',
          accent: '#f97316',
          'accent-hover': '#ea580c',
          orange: '#f97316',
          'orange-hover': '#ea580c',
          red: '#ef4444',
          green: '#22c55e',
          text: '#f5f5f5',
          secondary: '#a3a3a3',
          muted: '#737373',
          dim: '#525252',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern':
          'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid-24': '24px 24px',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(249,115,22,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(249,115,22,0.4)' },
        },
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgba(249,115,22,0.15)' },
          '50%': { borderColor: 'rgba(249,115,22,0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-border': 'pulse-border 2s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
