/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#0B0F14',
          surface: '#121820',
          elevated: '#18212B',
          border: '#26313D',
          primaryText: '#F5F7FA',
          secondaryText: '#94A3B8',
          muted: '#64748B',
          accent: '#38A8FF',
          safe: '#22C55E',
          warning: '#F59E0B',
          critical: '#EF4444'
        }
      }
    },
  },
  plugins: [],
}
