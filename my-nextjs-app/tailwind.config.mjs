import { Config } from 'tailwindcss';

const config = {
  darkMode: 'class', // Enable dark mode
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        background: '#0d0d0d', // Darker background color
        foreground: '#f7fafc', // Light foreground color
      },
    },
  },
  plugins: [],
};

export default config;