/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#18181b',
        foreground: '#f4f4f5',
        card: {
          DEFAULT: '#1f1f23',
          foreground: '#f4f4f5'
        },
        popover: {
          DEFAULT: '#1f1f23',
          foreground: '#f4f4f5'
        },
        primary: {
          DEFAULT: '#a855f7',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#27272a',
          foreground: '#f4f4f5'
        },
        muted: {
          DEFAULT: '#27272a',
          foreground: '#a1a1aa'
        },
        accent: {
          DEFAULT: '#3f3f46',
          foreground: '#f4f4f5'
        },
        border: '#27272a',
        input: '#27272a'
      }
    }
  },
  plugins: []
}
