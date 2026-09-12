/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FFF8F0',
          50: '#FFFCF8',
          100: '#FFF5E8',
          200: '#FFE8D0',
          300: '#FFD9B0',
          400: '#FFC080',
          500: '#FFA050',
          600: '#FF7020',
          700: '#FF4000',
          800: '#CC2000',
          900: '#991000',
        },
        coral: {
          DEFAULT: '#FF6B4A',
          50: '#FFF0EB',
          100: '#FFE0D6',
          200: '#FFC0B0',
          300: '#FFA08A',
          400: '#FF8064',
          500: '#FF6B4A',
          600: '#FF5030',
          700: '#FF3010',
          800: '#CC2008',
          900: '#991804',
        },
        softPurple: {
          DEFAULT: '#C4A1FF',
          50: '#F8F2FF',
          100: '#F0E4FF',
          200: '#E0C8FF',
          300: '#D0ACFF',
          400: '#C090FF',
          500: '#C4A1FF',
          600: '#A070FF',
          700: '#8040FF',
          800: '#6020CC',
          900: '#401899',
        },
        navy: {
          DEFAULT: '#1A1A2E',
          50: '#E6E6F0',
          100: '#C0C0D0',
          200: '#9090A0',
          300: '#606070',
          400: '#404050',
          500: '#1A1A2E',
          600: '#101020',
          700: '#0A0A15',
          800: '#05050A',
          900: '#000005',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}