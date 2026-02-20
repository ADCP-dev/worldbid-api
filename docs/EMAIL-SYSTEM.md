# Email System — Transactional Mails, Templates & Queue

The email system has three layers:
1. **`MailerService`** — Low-level Nodemailer wrapper (infrastructure layer).
2. **`MailService`** — High-level service that builds email content and calls the mailer.
3. **`EmailQueueModule`** — BullMQ-based background queue for async delivery.

---

## Architecture

```
EmailQueueModule (BullMQ + Redis)
          │ async path (default)
          ▼
MailService ──────────────────────────────── sync path (fallback / testing)
          │                                           │
          ▼                                           ▼
QueuedMailerService                         MailerService (Nodemailer)
          │
          ▼
EmailProcessor (worker) → MailerService → SMTP server
```

---

## MailService

Located at `src/modules/communications/mail/mail.service.ts`.

### Available Methods

| Method | Description |
|---|---|
| `userSignUp(mailData, async?)` | Sends email confirmation link after registration |
| `forgotPassword(mailData, async?)` | Sends password reset link |
| `confirmNewEmail(mailData, async?)` | Confirms an email address change |

All methods accept an `async` boolean (default: `true`). When `true`, the email is sent via BullMQ in the background. When `false`, it is sent synchronously (useful in tests or immediate-confirmation flows).

### Injecting and Using MailService

```typescript
import { MailService } from '@comms/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(private readonly mailService: MailService) {}

  async sendWelcomeEmail(user: User, hash: string) {
    await this.mailService.userSignUp({
      to: user.email,
      data: { hash },
    });
  }
}
```

### Adding a New Email Type

1. Add a new method to `MailService`:

```typescript
async myNewEmail(mailData: MailData<{ link: string }>, async = true): Promise<void> {
  const i18n = I18nContext.current();
  const subject = await i18n?.t('my-module.emailSubject');

  const mailOptions = {
    to: mailData.to,
    subject: subject ?? 'Notification',
    text: mailData.data.link,
    templatePath: path.join(
      this.configService.getOrThrow('app.workingDirectory', { infer: true }),
      'src', 'modules', 'communications', 'mail', 'mail-templates', 'build',
      'my-new-template.hbs',  // compiled Handlebars template
    ),
    context: {
      link: mailData.data.link,
      app_name: this.configService.get('app.name', { infer: true }),
    },
  };

  if (async) {
    await this.queuedMailerService.sendMail(mailOptions);
  } else {
    await this.mailerService.sendMail(mailOptions);
  }
}
```

2. Create the email template (see below).

---

## Email Templates (Maizzle)

Templates are written with **Maizzle** — Tailwind CSS for email.

### Locations

```
apps/back/
├── src/
│   └── modules/communications/mail/
│       └── mail-templates/
│           ├── emails/          # Source templates (.html)
│           │   ├── activation.html
│           │   ├── reset-password.html
│           │   └── confirm-new-email.html
│           └── build/           # Compiled output (.hbs) ← used by MailService
│               ├── activation.hbs
│               ├── reset-password.hbs
│               └── confirm-new-email.hbs
└── maizzle.config.js            # Maizzle build config
```

### Creating a New Template

1. Create `apps/back/src/modules/communications/mail/mail-templates/emails/my-new-template.html`:

```html
---
title: "My Notification"
preheader: "You have a new notification"
---

<x-main>
  <p>Hello!</p>
  <p>{{ link }}</p>
  <a href="{{ link }}">Click here</a>
</x-main>
```

2. Compile templates:

```bash
cd apps/back
npm run maizzle:build
```

This outputs compiled `.hbs` files to `mail-templates/build/`.

---

## Email Queue (BullMQ)

### Setup

Redis is required for the queue. Set `REDIS_URL` in `.env`.

If Redis is not configured, `EmailQueueModule` logs `Redis enabled: false` and falls back to synchronous sending.

### How It Works

1. `MailService` calls `QueuedMailerService.sendMail(options)`.
2. `QueuedMailerService` adds the job to a BullMQ queue.
3. `EmailProcessor` (a BullMQ worker) picks up the job and calls `MailerService.sendMail()`.

### Module Registration

`EmailQueueModule` is self-registering. No extra config needed:

```typescript
// app.module.ts
EmailQueueModule.register(),
```

---

## SMTP Configuration

Set these in `.env`:

```bash
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASSWORD=your-password
MAIL_IGNORE_TLS=false
MAIL_SECURE=false
MAIL_REQUIRE_TLS=true
MAIL_DEFAULT_EMAIL=noreply@example.com
MAIL_DEFAULT_NAME="Foundation App"
```

---

## Internationalized Email Content

Email subjects and body text are translated via `nestjs-i18n`. Translation files live in:

```
src/i18n/
├── en/
│   └── common.json     # common.confirmEmail, common.resetPassword...
└── es/
    └── common.json
```

The language is determined at request time via the `x-custom-lang` HTTP header (configurable via `APP_HEADER_LANGUAGE` env var).
