/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sarabun: ['Sarabun', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        sapphire: {
          50: '#f0f5fb',
          100: '#e0eaf7',
          200: '#c1d5f0',
          300: '#a3c0e8',
          400: '#84abe0',
          500: '#5E9BEB',
          600: '#4a7bc9',
          700: '#375ba7',
          800: '#243b85',
          900: '#111b63',
        },
      },
      borderRadius: {
        '2xl': '28px',
        '3xl': '30px',
      },
      boxShadow: {
        'neo': '0 4px 12px rgba(0, 0, 0, 0.12)',
        'neo-lg': '0 8px 24px rgba(0, 0, 0, 0.16)',
      },
    },
  },
  plugins: [],
}
