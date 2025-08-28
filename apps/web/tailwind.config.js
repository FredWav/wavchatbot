/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'wav-blue': '#3B82F6',
        'wav-purple': '#8B5CF6',
        'wav-green': '#10B981',
      },
      animation: {
        'gentle-pulse': 'gentle-pulse 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}