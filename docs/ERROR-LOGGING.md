# Sistema de Error Logging

## Visión General

El sistema de error logging es un módulo completo para tracking de errores graves en la aplicación. Permite registrar, visualizar y gestionar errores del backend y frontend de forma centralizada.

**Características principales:**

- Solo registra errores graves (500+)
- Deduplicación por hash
- Dashboard visual en el frontend
- Gestión de errores (resolver, borrar)

---

## Cómo Funciona

### 1. Captura de Errores

#### Backend (NestJS)

El sistema captura errores automáticamente a través de:

1. **GlobalExceptionFilter**: Intercepts todas las excepciones HTTP con status 500+
2. **Process Listeners**: Captura `unhandledRejection` y `uncaughtException`
3. **API Endpoint**: Permite reportar errores manualmente

#### Frontend (Nuxt)

Los errores del frontend se capturan automáticamente mediante un plugin que intercepta:

1. **Errores de Vue** - Errores en componentes Vue
2. **Unhandled Rejections** - Promesas sin capturar
3. **Errores globales** - Errores de JavaScript en ventana

El plugin ignora automáticamente errores 400, 401, 403, 422 (respuestas de validación).

También puedes reportar errores manualmente si lo necesitas:

```typescript
const { reportError } = useErrors();

await reportError({
  message: "Error description",
  source: "Frontend - ComponentName",
  stack: error.stack,
  metadata: { route: window.location.pathname },
});
```

### 2. Deduplicación

Cuando se reporta un error:

1. Se genera un hash SHA256 basado en: mensaje + source + primeros 200 chars del stack
2. Si ya existe un error con ese hash y está activo (`resolved: false`), se incrementa `occurrences`
3. Si no existe, se crea un nuevo registro

### 3. Estados

- **Active**: Error sin resolver
- **Resolved**: Error marcado como solucionado

---

## Estructura del Código

### Backend

```
apps/back/src/modules/error-tracker/
├── error-tracker.module.ts       # Módulo NestJS
├── error-tracker.service.ts      # Lógica de negocio
├── error-tracker.controller.ts   # Endpoints API
├── test-error.controller.ts      # Endpoints de test
├── dto/
│   └── create-error.dto.ts       # DTO para crear errores
├── entities/
│   └── error-log.entity.ts       # Entidad TypeORM
└── filters/
    └── global-exception.filter.ts # Filtro global
```

### Frontend

```
apps/front/modules/error-tracker/
├── components/
│   └── ErrorDashboard.vue        # Dashboard visual
├── composables/
│   └── useErrors.ts              # Funciones para API
├── pages/
│   └── admin/
│       └── errors.vue            # Página de errores
├── plugins/
│   ├── nav.ts                    # Añade al sidebar (solo admin)
│   └── error-handler.client.ts   # Captura automática de errores
└── nuxt.config.ts                # Config del módulo
```

---

## Endpoints API

| Método | Ruta                                | Descripción      | Auth  |
| ------ | ----------------------------------- | ---------------- | ----- |
| POST   | `/api/v1/system/errors`             | Reportar error   | No    |
| GET    | `/api/v1/system/errors`             | Listar errores   | Admin |
| DELETE | `/api/v1/system/errors`             | Borrar todos     | Admin |
| DELETE | `/api/v1/system/errors/resolved`    | Borrar resueltos | Admin |
| PATCH  | `/api/v1/system/errors/:id/resolve` | Resolver error   | Admin |
| DELETE | `/api/v1/system/errors/:id`         | Borrar error     | Admin |
| GET    | `/api/v1/system/test/error-500`     | Test 500         | No    |

---

## Notificaciones con Telegram (Opcional)

### 1. Instalar dependencia

```bash
cd apps/back
pnpm add node-telegram-bot-api
```

### 2. Crear servicio de notificaciones

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
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
```

### 3. Integrar en el servicio

```typescript
// En error-tracker.service.ts
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

      // Notificar solo si occurrences es múltiplo de 5 o 10
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

    // Notificar nuevo error
    await this.telegramNotifier.notifyNewError(saved);

    return saved;
  }
}
```

### 4. Configurar variables de entorno

```env
# .env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 5. Obtener el Token de Telegram

1. Busca @BotFather en Telegram
2. Envía `/newbot` y sigue las instrucciones
3. Copia el token que te da
4. Envía cualquier mensaje al bot
5. Obtén el chat ID usando: `https://api.telegram.org/bot<TOKEN>/getUpdates`

---

## Variables de Entorno

No hay variables específicas para el módulo de error logging, pero para Telegram:

| Variable             | Descripción                              |
| -------------------- | ---------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram                |
| `TELEGRAM_CHAT_ID`   | ID del chat donde recibir notificaciones |

---

## Errores Ignorados

El sistema **NO** registra:

- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 422 Unprocessable Entity

El sistema **SÍ** registra:

- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- Errores de proceso (unhandledRejection, uncaughtException)
