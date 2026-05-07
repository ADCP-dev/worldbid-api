#!/usr/bin/env node
/**
 * Send test emails to Mailpit for visual verification.
 * Usage: node scripts/test-email.js [template]
 *
 * Templates: activation, reset-password, confirm-new-email (default: activation)
 *
 * Requires: Mailpit running on localhost:1025
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const template = process.argv[2] || 'activation';
const bodyFile = path.join(ROOT, 'apps/back/src/modules/communications/mail/mail-templates/build', `${template}.hbs`);

// ─── 1. Read compiled template ────────────────────────────────────────────

if (!fs.existsSync(bodyFile)) {
  console.error(`❌ Template not found: ${bodyFile}`);
  console.error('   Run first: cd apps/back && pnpm maizzle:build');
  process.exit(1);
}

const body = fs.readFileSync(bodyFile, 'utf-8');

// ─── 2. Read layout ───────────────────────────────────────────────────────

const layoutFile = path.join(ROOT, 'apps/back/src/modules/communications/mail/mail-templates/build/layouts/main.hbs');

function wrapBody(html) {
  // Simple layout wrapper — uses inline styles for email client compatibility
  return html
}

// ─── 3. Inject test context ────────────────────────────────────────────────

const testContext = {
  activation: {
    title: 'Confirma tu email',
    subject: 'Confirma tu email',
    app_name: 'Foundation',
    app_url: 'http://localhost:3001',
    link: 'https://foundation.app/confirm-email?hash=test',
    greeting: 'Hola Juan,',
    body_text: 'Gracias por registrarte en Foundation. Confirma tu email para activar tu cuenta.',
    button_text: 'Confirmar email',
    ignore_text: 'Si no fuiste vos, ignora este mensaje.',
  },
  'reset-password': {
    title: 'Restablece tu contraseña',
    subject: 'Restablece tu contraseña',
    app_name: 'Foundation',
    app_url: 'http://localhost:3001',
    link: 'https://foundation.app/password-change?hash=test',
    greeting: 'Hola Juan,',
    body_text: 'Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva.',
    button_text: 'Restablecer contraseña',
    ignore_text: 'Si no fuiste vos, ignora este mensaje.',
  },
  'confirm-new-email': {
    title: 'Confirma tu nuevo email',
    subject: 'Confirma tu nuevo email',
    app_name: 'Foundation',
    app_url: 'http://localhost:3001',
    link: 'https://foundation.app/confirm-new-email?hash=test',
    greeting: 'Hola Juan,',
    body_text: 'Solicitaste cambiar tu dirección de email. Confirma la nueva dirección.',
    button_text: 'Confirmar nuevo email',
  },
};

const ctx = testContext[template] || testContext.activation;

// Replace Handlebars variables
let html = body;
for (const [key, value] of Object.entries(ctx)) {
  html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
}

html = wrapBody(html);

const fullEmail = [
  `From: Foundation <no-reply@foundation.app>`,
  `To: admin@foundation.app`,
  `Subject: ${ctx.title || 'Test Email'}`,
  `Content-Type: text/html; charset=UTF-8`,
  ``,
  html,
].join('\r\n');

// ─── 4. Send via SMTP to Mailpit ───────────────────────────────────────────

const net = require('node:net');

const client = net.createConnection({ host: 'localhost', port: 1025 }, () => {
  client.write(`EHLO localhost\r\n`);
  client.write(`MAIL FROM:<no-reply@foundation.app>\r\n`);
  client.write(`RCPT TO:<admin@foundation.app>\r\n`);
  client.write(`DATA\r\n`);
  client.write(fullEmail + `\r\n`);
  client.write(`.\r\n`);
  client.write(`QUIT\r\n`);
});

client.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('250 OK')) {
    console.log(`✅ Test email sent: ${template}`);
    console.log('   View at http://localhost:8025');
  }
});

client.on('error', (err) => {
  console.error('❌ SMTP error:', err.message);
  console.error('   Make sure Mailpit is running: mailpit');
  process.exit(1);
});

client.on('close', () => {
  process.exit(0);
});

setTimeout(() => {
  console.error('❌ SMTP timeout');
  process.exit(1);
}, 5000);
