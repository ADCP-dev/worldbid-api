# Spec: Autonomous Agent

## Purpose

Bucle autónomo que schedula, ejecuta, monitoriza, y aprende del pipeline de contenido. Coordina content-pipeline via BullMQ queues y @Cron. Feedback loop: métricas → research.

## Requirements

### Requirement: Agent Configuration

The system MUST provide configurable agent settings per project, including schedule, autonomy level, and notification preferences.

#### Scenario: Configurar agente

- GIVEN admin autenticado
- WHEN POST /autonomous-agent/configs con {projectId, schedule, autoApproveIdeas, autoApproveDrafts, notifyTelegram, notifyEmail}
- THEN config se guarda y agente empieza a ejecutar según schedule

#### Scenario: Pausar agente

- GIVEN agente activo
- WHEN PATCH /autonomous-agent/configs/:id con {status: "paused"}
- THEN agente deja de ejecutar runs hasta que se resume

### Requirement: Scheduled Pipeline Runs

The system MUST execute pipeline runs on schedule using BullMQ queues.

#### Scenario: Run diario de research

- GIVEN agente activo con schedule researchCron = "0 9 * * *"
- WHEN cron dispara
- THEN sistema encola job "research" en BullMQ queue
- AND job ejecuta TrendResearchService para el proyecto
- AND ideas generadas se guardan en content-pipeline

#### Scenario: Run diario de generation

- GIVEN agente activo con schedule generateCron = "0 10 * * *"
- WHEN cron dispara
- THEN sistema encola job "generate" para cada idea aprobada
- AND job ejecuta ContentGeneratorService
- AND drafts generados se guardan con status "draft"

#### Scenario: Run diario de publish

- GIVEN agente activo con schedule publishCron = "0 18 * * *"
- WHEN cron dispara
- THEN sistema encola job "publish" para cada draft aprobado
- AND job ejecuta PublishingService
- AND contenido se publica a CMS/Upload-Post

### Requirement: Run Tracking

The system MUST track each agent run with status, duration, output, and errors.

#### Scenario: Run exitoso

- GIVEN job encola ejecutado sin errores
- WHEN job completa
- THEN agent-run record se crea con status "completed", duration, output summary
- AND agent-run se asocia al proyecto

#### Scenario: Run con error

- GIVEN job encola ejecutado y falla
- WHEN job falla después de retries
- THEN agent-run record se crea con status "failed", errorMessage
- AND alerta se envía via notification config

### Requirement: Feedback Loop

The system SHOULD adjust research strategy based on performance metrics from published content.

#### Scenario: Feedback loop ajusta research

- GIVEN métricas recopiladas en los últimos 7 días
- WHEN agente ejecuta research
- THEN sistema analiza qué topics/keywords performaron mejor
- AND prioriza ideas similares en la próxima ronda de research
- AND guarda feedbackData en agent-config

#### Scenario: Sin métricas suficientes

- GIVEN menos de 3 drafts publicados con métricas
- WHEN feedback loop ejecuta
- THEN sistema omite ajuste y usa research default

### Requirement: Notifications

The system MUST notify the user via email and/or Telegram after each run cycle and weekly summary.

#### Scenario: Notificación post-run

- GIVEN agente completó un ciclo (research + generate + publish)
- WHEN ciclo finaliza
- THEN sistema envía email a NOTIFICATION_EMAIL (o extension-specific)
- AND email contiene: ideas generadas, drafts generados, posts publicados, errores

#### Scenario: Notificación semanal

- GIVEN agente activo por 7 días
- WHEN cron semanal dispara (lunes 9:00)
- THEN sistema recopila métricas de la semana
- AND envía reporte con: total posts, views, clicks, engagement, revenue estimado
- AND usa QueuedMailerService con NOTIFICATION_EMAIL chain

#### Scenario: Sin email configurado

- GIVEN NOTIFICATION_EMAIL no configurada Y agent config sin email
- WHEN notificación se intenta
- THEN sistema loguea warning y omite envío (no crash)

### Requirement: Autonomy Levels

The system MUST support configurable autonomy levels: full-manual, semi-auto, full-auto.

#### Scenario: Full-manual

- GIVEN agent.config.autoApproveIdeas = false Y autoApproveDrafts = false
- WHEN pipeline ejecuta
- THEN ideas requieren aprobación humana Y drafts requieren aprobación humana
- AND nada se publica sin intervención

#### Scenario: Semi-auto

- GIVEN agent.config.autoApproveIdeas = true Y autoApproveDrafts = false
- WHEN research genera ideas
- THEN ideas se auto-aprueban Y se generan drafts automáticamente
- AND drafts requieren aprobación humana antes de publicar

#### Scenario: Full-auto

- GIVEN agent.config.autoApproveIdeas = true Y autoApproveDrafts = true
- WHEN pipeline ejecuta completo
- THEN todo se publica sin intervención humana
- AND notificación post-run informa qué se publicó

### Requirement: Error Recovery

The system MUST handle failures gracefully with retry logic and dead letter queue.

#### Scenario: LLM timeout

- GIVEN ContentGeneratorService llama a Ollama Cloud
- WHEN request timeout (60s)
- THEN BullMQ retry 3 veces con exponential backoff
- AND si sigue fallando, job va a dead letter queue
- AND alerta se envía

#### Scenario: WaveSpeed API down

- GIVEN ImageGeneratorService llama a WaveSpeed
- WHEN API responde 503
- THEN sistema reintenta 3 veces
- AND si falla, draft se guarda sin imágenes (no bloquear publicación)
- AND warning se loguea