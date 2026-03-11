# Error Logging System

## Overview

The error logging system is a complete module for tracking critical errors in the application. It allows recording, viewing, and managing backend and frontend errors in a centralized manner.

**Key features:**

- Only logs critical errors (500+)
- Deduplication by hash
- Visual dashboard in frontend
- Error management (resolve, delete)

---

## How It Works

### 1. Error Capture

#### Backend (NestJS)

The system automatically captures errors through:

1. **GlobalExceptionFilter**: Intercepts all HTTP exceptions with status 500+
2. **Process Listeners**: Captures `unhandledRejection` and `uncaughtException`
3. **API Endpoint**: Allows reporting errors manually

#### Frontend (Nuxt)

Frontend errors are automatically captured through a plugin that intercepts:

1. **Vue Errors** - Errors in Vue components
2. **Unhandled Rejections** - Uncaught promises
3. **Global Errors** - JavaScript errors in window

The plugin automatically ignores 400, 401, 403, 422 errors (validation responses).

You can also manually report errors if needed:

```typescript
const { reportError } = useErrors();

await reportError({
  message: "Error description",
  source: "Frontend - ComponentName",
  stack: error.stack,
  metadata: { route: window.location.pathname },
});
```

### 2. Deduplication

When an error is reported:

1. A SHA256 hash is generated based on: message + source + first 200 chars of stack
2. If an error with that hash already exists and is active (`resolved: false`), `occurrences` is incremented
3. If it doesn't exist, a new record is created

### 3. States

- **Active**: Unresolved error
- **Resolved**: Error marked as solved

---

## Code Structure

### Backend

```
apps/back/src/modules/error-tracker/
├── error-tracker.module.ts       # NestJS module
├── error-tracker.service.ts      # Business logic
├── error-tracker.controller.ts   # API endpoints
├── test-error.controller.ts      # Test endpoints
├── dto/
│   └── create-error.dto.ts       # DTO for creating errors
├── entities/
│   └── error-log.entity.ts       # TypeORM entity
└── filters/
    └── global-exception.filter.ts # Global filter
```

### Frontend

```
apps/front/modules/error-tracker/
├── components/
│   └── ErrorDashboard.vue        # Visual dashboard
├── composables/
│   └── useErrors.ts              # API functions
├── pages/
│   └── admin/
│       └── errors.vue            # Errors page
├── plugins/
│   ├── nav.ts                    # Adds to sidebar (admin only)
│   └── error-handler.client.ts   # Automatic error capture
└── nuxt.config.ts                # Module config
```

---

## API Endpoints

| Method | Path                                | Description     | Auth  |
| ------ | ----------------------------------- | --------------- | ----- |
| POST   | `/api/v1/system/errors`             | Report error    | No    |
| GET    | `/api/v1/system/errors`             | List errors     | Admin |
| DELETE | `/api/v1/system/errors`             | Delete all      | Admin |
| DELETE | `/api/v1/system/errors/resolved`    | Delete resolved | Admin |
| PATCH  | `/api/v1/system/errors/:id/resolve` | Resolve error   | Admin |
| DELETE | `/api/v1/system/errors/:id`         | Delete error    | Admin |
| GET    | `/api/v1/system/test/error-500`     | Test 500        | No    |

---

## Telegram Notifications (Optional)

### 1. Install dependency

```bash
cd apps/back
pnpm add node-telegram-bot-api
```

### 2. Create notification service

```typescript
// apps/back/src/modules/error-tracker/services/telegram-notifier.service.ts
import { Injectable } from "@nestjs/common";
import TelegramBot from "node-telegram-bot-api";
import { ErrorLogEntity } from "../entities/error-log.entity";

@Injectable()
export class TelegramNotifierService {
  private bot: TelegramBot | null = null;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && this.chatId) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  async notifyNewError(error: ErrorLogEntity): Promise<void> {
    if (!this.bot) return;

    const message = this.buildMessage(error);

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch (err) {
      console.error("Failed to send Telegram notification:", err);
    }
  }

  private buildMessage(error: ErrorLogEntity): string {
    const emoji = error.occurrences > 1 ? "⚠️" : "❌";

    return `
${emoji} <b>New Error Detected</b>

<b>Message:</b> ${this.escapeHtml(error.message)}
<b>Source:</b> ${this.escapeHtml(error.source)}
<b>Occurrences:</b> ${error.occurrences}
<b>First:</b> ${new Date(error.firstOccurredAt).toLocaleString()}
<b>Last:</b> ${new Date(error.lastOccurredAt).toLocaleString()}

<code>${this.escapeHtml(error.stack?.substring(0, 500) || "No stack")}</code>
    `.trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """);
  }
}
```

### 3. Integrate into service

```typescript
// In error-tracker.service.ts
import { TelegramNotifierService } from "./services/telegram-notifier.service";

@Injectable()
export class ErrorTrackerService {
  constructor(
    @InjectRepository(ErrorLogEntity)
    private errorLogRepo: Repository<ErrorLogEntity>,
    private telegramNotifier: TelegramNotifierService,
  ) {}

  async logError(dto: CreateErrorDto): Promise<ErrorLogEntity> {
    const hash = this.generateHash(dto.message, dto.source || "", dto.stack);

    const existingError = await this.errorLogRepo.findOne({
      where: { hash, resolved: false },
    });

    if (existingError) {
      existingError.occurrences += 1;
      existingError.lastOccurredAt = new Date();
      const saved = await this.errorLogRepo.save(existingError);

      // Notify only if occurrences is multiple of 5 or 10
      if (saved.occurrences % 5 === 0 || saved.occurrences === 10) {
        await this.telegramNotifier.notifyNewError(saved);
      }

      return saved;
    }

    const newError = this.errorLogRepo.create({
      ...dto,
      hash,
      occurrences: 1,
      resolved: false,
      resolvedAt: null,
      firstOccurredAt: new Date(),
      lastOccurredAt: new Date(),
    });

    const saved = await this.errorLogRepo.save(newError);

    // Notify new error
    await this.telegramNotifier.notifyNewError(saved);

    return saved;
  }
}
```

### 4. Configure environment variables

```env
# .env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 5. Get Telegram Token

1. Search for @BotFather in Telegram
2. Send `/newbot` and follow instructions
3. Copy the token it gives you
4. Send any message to the bot
5. Get the chat ID using: `https://api.telegram.org/bot<TOKEN>/getUpdates`

---

## Environment Variables

There are no specific variables for the error logging module, but for Telegram:

| Variable             | Description                      |
| -------------------- | -------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token               |
| `TELEGRAM_CHAT_ID`   | Chat ID to receive notifications |

---

## Ignored Errors

The system does **NOT** log:

- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 422 Unprocessable Entity

The system **DOES** log:

- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- Process errors (unhandledRejection, uncaughtException)
