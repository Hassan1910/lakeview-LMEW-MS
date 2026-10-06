/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lmew: {
          blue: {
            950: '#031427',
            900: '#062140',
            800: '#0B4F6C', // Primary
            700: '#0F4C81',
            600: '#1967B2',
            100: '#E0F2FE',
            50: '#F0F9FF',
          },
          teal: {
            700: '#0369A1',
            600: '#0284C7',
            500: '#01BAEF', // Accent
            100: '#E0F2FE',
          },
          gold: {
            600: '#D97706',
            500: '#F59E0B',
            100: '#FEF3C7',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
