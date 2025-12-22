/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        // Default breakpoints:
        // 'sm': '640px',
        // 'md': '768px',
        // 'lg': '1024px',
        // 'xl': '1280px',
        // '2xl': '1536px',
      },
      spacing: {
        'touch': '44px', // Minimum touch target size for mobile
      },
      colors: {
        // Diamond Lease Theme Colors
        'dl-red': {
          DEFAULT: '#D50000',
          hover: '#B80000',
        },
        'dl-grey': {
          DEFAULT: '#333333',
          light: '#777777',
          medium: '#E0E0E0',
          bg: '#F5F5F5',
          'bg-alt': '#F9F9F9',
        },
        'dl-yellow': {
          DEFAULT: '#FFB800',
          hover: '#E6A500',
        },
      },
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'base': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'lg': ['18px', { lineHeight: '1.5', fontWeight: '400' }],
        'xl': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        '2xl': ['24px', { lineHeight: '1.4', fontWeight: '600' }],
        '3xl': ['32px', { lineHeight: '1.35', fontWeight: '600', letterSpacing: '-0.01em' }],
        '4xl': ['42px', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.02em' }],
        '5xl': ['48px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1': ['42px', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h2': ['32px', { lineHeight: '1.35', fontWeight: '600', letterSpacing: '-0.01em' }],
        'h3': ['24px', { lineHeight: '1.4', fontWeight: '600' }],
        'h4': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'h5': ['18px', { lineHeight: '1.5', fontWeight: '600' }],
        'h6': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      borderRadius: {
        'dl': '6px',
        'dl-sm': '4px',
      },
      boxShadow: {
        'dl': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'dl-lg': '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
