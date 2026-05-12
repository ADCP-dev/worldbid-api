const path = require('node:path');

/** @type {import('@maizzle/framework').Config} */
module.exports = {
  components: {
    folders: [
      path.resolve(__dirname, 'src/modules/communications/mail/mail-templates/layouts'),
    ],
  },
  build: {
    content: [
      path.resolve(__dirname, 'src/modules/communications/mail/mail-templates/emails') + '/**/*.hbs',
    ],
    output: {
      path: path.resolve(__dirname, 'src/modules/communications/mail/mail-templates/build'),
    },
  },
  css: {
    inline: true,
    purge: true,
  },
  tailwind: {
    config: './tailwind.email.config.js',
  },
  prettify: true,
  minify: false,
  server: {
    port: 3001,
  },
};
