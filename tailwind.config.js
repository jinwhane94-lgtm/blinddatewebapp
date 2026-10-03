/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fff0f6',
          100: '#ffd6e8',
          200: '#ffadd4',
          300: '#ff7db5',
          400: '#ff4d96',
          500: '#f72585',
          600: '#d4006a',
          700: '#a5004f',
          800: '#780038',
          900: '#4d001f',
        },
        accent: {
          50:  '#eef2ff',
          100: '#d4dcff',
          200: '#b0beff',
          300: '#8093ff',
          400: '#5166ff',
          500: '#3a0ca3',
          600: '#2f0880',
          700: '#23065f',
          800: '#180440',
          900: '#0d0220',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
