import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CREACOM brand palette
        brand: {
          DEFAULT: '#C73E2C', // rojo CREACOM
          dark: '#9C2A1C',
          light: '#FCEDEA',
          accent: '#E55B47',
        },
        ink: {
          primary: '#1A1A1A',
          secondary: '#5C5C5C',
          tertiary: '#9B9B9B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7F5F2',
          border: '#E5E1DC',
          elevated: '#FAFAF9',
        },
        success: { DEFAULT: '#1B7A52', soft: '#E1F4ED' },
        warning: { DEFAULT: '#C77800', soft: '#FBEFD8' },
        danger: { DEFAULT: '#7E1F1F', soft: '#F4DAD6' },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26, 26, 26, 0.04), 0 1px 3px rgba(26, 26, 26, 0.06)',
        card: '0 2px 4px rgba(26, 26, 26, 0.04), 0 4px 12px rgba(26, 26, 26, 0.06)',
        elevated: '0 4px 8px rgba(26, 26, 26, 0.06), 0 12px 32px rgba(26, 26, 26, 0.08)',
        premium:
          '0 1px 2px rgba(199, 62, 44, 0.06), 0 4px 16px rgba(26, 26, 26, 0.08), 0 16px 48px rgba(26, 26, 26, 0.05)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'logo-pop': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'bar-fill': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'fade-in-up-delayed': 'fade-in-up 0.6s ease-out 0.3s backwards',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'logo-pop': 'logo-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'bar-fill': 'bar-fill 1.6s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
