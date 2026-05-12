/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Synced with frontend DaisyUI theme (apps/front/assets/css/tailwind.css)
        // --color-primary: oklch(58% 0.233 277.117) ≈ #8b5cf6
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },
    },
  },
  // Only include utilities needed for email
  corePlugins: {
    preflight: false,
  },
};
