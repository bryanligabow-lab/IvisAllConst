import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#534AB7',
          dark: '#3F379A',
          light: '#F0EFFB',
        },
        ink: {
          primary: '#1F1E20',
          secondary: '#6B6A6E',
          tertiary: '#A4A3A6',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F6F5F1',
          border: '#E6E4DD',
        },
        success: { DEFAULT: '#0F6E56', soft: '#E1F4ED' },
        warning: { DEFAULT: '#B26905', soft: '#FBEFD8' },
        danger: { DEFAULT: '#C0392B', soft: '#FBE3E1' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { md: '6px', lg: '10px' },
    },
  },
  plugins: [],
};

export default config;
