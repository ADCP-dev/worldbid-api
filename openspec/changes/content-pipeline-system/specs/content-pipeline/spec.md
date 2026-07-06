# Spec: Content Pipeline

## Purpose

Pipeline de contenido multi-nicho que orquesta research → ideas → drafts → publicación. Integra CMS, Upload-Post, y Affiliate opcionalmente via runtime detection.

## Requirements

### Requirement: Multi-Nicho Projects

The system MUST support multiple content projects (nichos) simultaneously, each with independent configuration.

#### Scenario: Crear proyecto nuevo

- GIVEN admin autenticado
- WHEN POST /content-pipeline/projects con {name, niche, keywords, brandVoice, language}
- THEN proyecto creado con status "active"
- AND proyecto tiene config independiente de afiliados, social, y CMS

#### Scenario: Listar proyectos

- GIVEN admin autenticado
- WHEN GET /content-pipeline/projects
- THEN retorna todos los proyectos con su status y stats (ideas count, drafts count, published count)

### Requirement: Trend Research

The system MUST research trending topics per project using Tavily API and generate content ideas.

#### Scenario: Trigger research manual

- GIVEN admin autenticado y proyecto existe
- WHEN POST /content-pipeline/projects/:id/ideas/research
- THEN sistema consulta Tavily con keywords del proyecto
- AND genera 3-5 ideas con title, angle, keywords, targetPlatforms, contentType
- AND ideas se guardan con status "idea" en el kanban

#### Scenario: Research sin Tavily key

- GIVEN TAVILY_API_KEY no configurada
- WHEN research se ejecuta
- THEN sistema loguea warning y retorna ideas vacías (no crash)

### Requirement: Idea Kanban

The system MUST provide a kanban board for ideas with status workflow: idea → approved → generating → generated → rejected.

#### Scenario: Aprobar idea

- GIVEN idea con status "idea"
- WHEN PATCH /content-pipeline/ideas/:id con {status: "approved"}
- THEN idea pasa a status "approved"
- AND idea queda disponible para generación automática

#### Scenario: Rechazar idea

- GIVEN idea con cualquier status
- WHEN PATCH /content-pipeline/ideas/:id con {status: "rejected"}
- THEN idea pasa a status "rejected" y se excluye del pipeline

### Requirement: Content Generation

The system MUST generate content drafts from approved ideas using LLM (GLM-5.2) and images using WaveSpeed AI.

#### Scenario: Generar draft desde idea aprobada

- GIVEN idea con status "approved"
- WHEN POST /content-pipeline/ideas/:id/generate
- THEN sistema genera blogContent (markdown) via LLM con brandVoice del proyecto
- AND genera 2+ imágenes via WaveSpeed (hero + content)
- AND genera socialVariants por plataforma configurada
- AND genera seoMetadata (metaTitle, metaDescription, slug, JSON-LD)
- AND crea draft con status "draft"

#### Scenario: LLM no configurado

- GIVEN Ollama Cloud no configurado
- WHEN generate se ejecuta
- THEN sistema loguea warning y no genera draft (no crash)

### Requirement: Affiliate Injection

The system SHOULD inject affiliate links into generated content if the affiliate extension is present and enabled.

#### Scenario: Affiliate activado

- GIVEN affiliate extension presente Y project.affiliateConfig.enabled = true
- WHEN draft se genera
- THEN sistema busca productos relevantes en affiliate programs configurados
- AND inyecta links con trackingId del proyecto
- AND añade disclosure text automáticamente

#### Scenario: Affiliate no presente

- GIVEN affiliate extension NO instalada
- WHEN draft se genera
- THEN sistema omite affiliate injection gracefully
- AND draft se genera sin links de afiliado

### Requirement: Publishing

The system MUST publish approved drafts to CMS (blog) and Upload-Post (social) if those extensions are present.

#### Scenario: Publicar a CMS

- GIVEN draft aprobado Y CMS extension presente
- WHEN POST /content-pipeline/drafts/:id/publish
- THEN sistema crea blog post via BlogPostsService.create()
- AND asigna featuredImage, category, author, tags
- AND marca draft.publishedTo.blogPostId

#### Scenario: Publicar a social

- GIVEN draft aprobado Y Upload-Post extension presente
- WHEN POST /content-pipeline/drafts/:id/publish
- THEN sistema programa social posts via UploadPostClientService
- AND respeta warmupPhase si socialConfig.warmupPhase = true
- AND marca draft.publishedTo.socialPosts

#### Scenario: CMS no presente

- GIVEN CMS extension NO instalada
- WHEN publish se ejecuta
- THEN sistema omite blog publish con warning
- AND publica solo a social si Upload-Post está presente

### Requirement: Metrics Tracking

The system MUST track performance metrics per project, per platform, per draft.

#### Scenario: Recopilar métricas semanales

- GIVEN drafts publicados en la semana
- WHEN cron semanal ejecuta
- THEN sistema recopila views, clicks, engagement de CMS y Upload-Post
- AND guarda snapshot en ext_cp_metrics
- AND genera reporte agregado por proyecto

### Requirement: SEO Optimization

The system MUST generate SEO metadata for each draft.

#### Scenario: Generar SEO meta

- GIVEN draft en generación
- WHEN content generator finaliza
- THEN draft.seoMetadata contiene metaTitle (≤60 chars), metaDescription (≤160 chars), focusKeyword, slug, JSON-LD schema
- AND JSON-LD type se selecciona según contentType (Recipe, Article, Product, FAQPage)

### Requirement: Two-Stage Approval

The system MUST enforce two approval gates: ideas and drafts. No content is published without human approval unless autoPublish is explicitly enabled.

#### Scenario: Auto-publish desactivado (default)

- GIVEN project.autoPublish.blog = false Y project.autoPublish.social = false
- WHEN draft se genera
- THEN draft queda en status "draft" esperando aprobación humana
- AND no se publica nada automáticamente

#### Scenario: Auto-publish activado

- GIVEN project.autoPublish.blog = true
- WHEN draft se aprueba en gate de ideas → genera → draft status "approved"
- THEN sistema publica automáticamente a CMS sin segunda aprobación