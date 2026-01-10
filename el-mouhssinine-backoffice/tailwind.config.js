/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7f4f24',
        secondary: '#c9a227',
        'primary-dark': '#5c3a1a',
        'bg-dark': '#1a1a1a',
        'bg-card': 'rgba(255,255,255,0.08)',
        'text-light': '#f5f0e8',
        'border-gold': 'rgba(201,162,39,0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
