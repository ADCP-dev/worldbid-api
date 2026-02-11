/** @type {import('@maizzle/framework').Config} */
module.exports = {
  components: {
    folders: ['src/mail/mail-templates/layouts'],
  },
  build: {
    content: ['./src/mail/mail-templates/emails/**/*.hbs'],
    output: {
      path: './src/mail/mail-templates/build',
    },
  },
  prettify: true,
  minify: true,
  server: {
    port: 3001,
  },
};
