/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cyber terminal theme
        terminal: {
          bg: '#000000',
          'bg-secondary': '#0a0e14',
          'bg-tertiary': '#111827',
          primary: '#00ff00',
          secondary: '#00cc00',
          accent: '#00ffaa',
          dim: '#008800',
          text: '#00ff00',
          'text-secondary': '#00cc00',
          'text-dim': '#006600',
          error: '#ff0040',
          warning: '#ffaa00',
          success: '#00ff00',
          border: '#00ff0040',
          'border-bright': '#00ff0080',
        },
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
        'terminal': ['"Source Code Pro"', '"Courier New"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 0.15s infinite',
        'scan': 'scan 8s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
      boxShadow: {
        'neon': '0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 20px #00ff00',
        'neon-sm': '0 0 2px #00ff00, 0 0 5px #00ff00',
      },
    },
  },
  plugins: [],
}
