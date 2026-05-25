# PRD: Sincronizar Tailwind del frontend con email templates

## 1. Problema

Las plantillas de email usan **Tailwind crudo sin compilar** (clases como `class="px-6 py-3 bg-indigo-600"`) en vez de CSS inline (`style="padding:...; background:..."`). Gmail, Outlook y la mayoría de clientes de correo no soportan clases CSS → los emails se ven rotos.

**Causa raíz**: Maizzle (el compilador Tailwind→CSS inline) está instalado pero NO funciona:
- `maizzle.config.js` apunta a `src/mail/` → debería apuntar a `src/modules/communications/mail/`
- `flatten-maizzle-output.js` tiene el mismo path roto
- El directorio `build/` (output compilado) no existe
- Las plantillas fuente están en formato `.hbs` cuando Maizzle espera `.html`

## 2. Estado Actual

### Archivos existentes
| Archivo | Estado |
|---------|--------|
| `maizzle.config.js` | ❌ Paths rotos |
| `flatten-maizzle-output.js` | ❌ Paths rotos |
| `mail-templates/layouts/main.hbs` | ⚠️ Contiene `@tailwind` y `<yield>` (Maizzle syntax) |
| `mail-templates/emails/activation.hbs` | ⚠️ Tailwind sin compilar + `<x-main>` |
| `mail-templates/emails/reset-password.hbs` | ⚠️ Tailwind sin compilar |
| `mail-templates/emails/confirm-new-email.hbs` | ⚠️ Tailwind sin compilar |
| `mail-templates/build/` | ❌ No existe |

### Stack
- **Tailwind CSS**: v3.4.17 (back) vs v4.1.3 (front) → no comparten config
- **Maizzle**: v5.0.8 → framework para compilar Tailwind a CSS inline
- **Handlebars**: runtime para variables `{{ name }}`
- **Nodemailer**: transporte SMTP

## 3. Solución Propuesta

### Fase 1: Arreglar el pipeline Maizzle

1. **Corregir paths** en `maizzle.config.js`:
   ```
   components: 'src/modules/communications/mail/mail-templates/layouts'
   content: 'src/modules/communications/mail/mail-templates/emails/**/*.hbs'
   output: 'src/modules/communications/mail/mail-templates/build'
   ```

2. **Corregir paths** en `flatten-maizzle-output.js`:
   ```
   buildDir = 'src/modules/communications/mail/mail-templates/build'
   ```

3. **Verificar compatibilidad Maizzle v5**: Las plantillas actuales usan `@tailwind` directives, `<x-main>`, `<yield>`. Verificar que Maizzle v5 soporta Handlebars (.hbs) como input. Si no, convertir a `.html` y regenerar `.hbs` como output.

4. **Ejecutar `pnpm maizzle:build`** → generar `build/*.hbs`

### Fase 2: Sincronizar estilos con el frontend

1. **Extraer tokens de diseño del frontend** (`apps/front/assets/css/tailwind.css`):
   - Colores: `--color-primary`, `--color-secondary`, etc.
   - Tipografía: `font-family`, tamaños
   - Bordes, sombras, espaciado

2. **Crear `tailwind.config.js` unificado** para email templates que use los mismos tokens que el frontend pero optimizado para email:
   ```js
   // tailwind.email.config.js
   module.exports = {
     theme: {
       extend: {
         colors: {
           primary: { 600: '#4f46e5', 500: '#6366f1', 100: '#e0e7ff' },
           // ... mismos tokens del frontend
         }
       }
     }
   }
   ```

3. **Actualizar Maizzle config** para usar el preset de email + tokens del frontend:
   ```js
   module.exports = {
     tailwind: {
       config: './tailwind.email.config.js',
     },
     css: {
       inline: true,
       purge: true,
     },
   }
   ```

### Fase 3: Mejorar las plantillas

1. **Layout base** con header, footer, colores de la marca
2. **Tokenizar variables** comunes (colores, espaciado, fuentes)
3. **Añadir partials** reutilizables: botón, header, footer
4. **Añadir logo** de la aplicación

## 4. Checklist

- [ ] Corregir `maizzle.config.js` paths
- [ ] Corregir `flatten-maizzle-output.js` paths
- [ ] Crear `tailwind.email.config.js` con tokens del frontend
- [ ] Verificar compatibilidad Maizzle v5 con `.hbs`
- [ ] Renombrar templates `.hbs` → `.html` si Maizzle v5 lo requiere
- [ ] Ejecutar `pnpm maizzle:build` y verificar output en `build/`
- [ ] Actualizar `mail.service.ts` si cambian paths de templates
- [ ] Test con Mailpit: verificar que estilos se inlinean correctamente
- [ ] Documentar el flujo en `docs/modules/email.md`

## 5. Riesgos

- **Maizzle v5 breaking changes**: puede requerir migración de sintaxis (`.hbs` → `.html`, `<x-main>` → otro componente)
- **Tailwind v3 vs v4**: los tokens de diseño son diferentes (v3 usa JS config, v4 usa CSS); hay que traducir manualmente
- **CSS inline limitaciones**: no todo el CSS de Tailwind se puede inlinear (gradients, hover, animations)
- **Handlebars + Maizzle**: ¿Maizzle v5 procesa `.hbs` con variables `{{ }}` sin romperlas?

## 6. Alternativas

Si Maizzle v5 no funciona bien con `.hbs`, considerar:
- **`maizzle` v4** (más estable, mejor documentado)
- **`@responsive-email/tailwindcss`** + Handlebars manual
- **`juice`** para inlinear CSS genérico
