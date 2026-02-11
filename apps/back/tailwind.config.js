/** @type {import('tailwindcss').Config} */
module.exports = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require('tailwindcss-preset-email')],
  content: [
    './src/mail/mail-templates/emails/*.hbs',
    './src/mail/mail-templates/layouts/*.hbs',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0055FF',
        // Add your brand colors
      },
    },
  },
  mode: 'jit',
  plugins: [],
};
