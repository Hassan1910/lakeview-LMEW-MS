/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lmew: {
          blue: {
            900: '#062140',
            800: '#0A3663',
            700: '#0F4C81',
          },
          teal: {
            500: '#0EA5E9',
            600: '#0284C7',
          },
        },
      },
    },
  },
  plugins: [],
};
