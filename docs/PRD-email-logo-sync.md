# PRD: Sincronizar logo entre frontend y emails

## 1. Problema

El logo del frontend y el de los emails son **completamente diferentes**:

| Ubicación | Logo | Estilo |
|-----------|------|--------|
| Frontend (`public/logo.svg`) | Diseño abstracto púrpura/rojo/amarillo | Sin texto, colores cálidos |
| Backend (`public/assets/banner.svg`) | Marca "MONO" | Geometrico verde/azul |

Cuando un usuario recibe un email, ve un logo que no reconoce → **rompe la confianza de marca**.

## 2. Origen

- El banner en emails se carga desde `{{app_url}}/assets/banner.svg`
- `app_url` = `BACKEND_DOMAIN` (default `http://localhost`)
- En producción, el backend sirve `assets/banner.svg` estáticamente
- El frontend NO comparte este asset — cada uno tiene su propio logo

## 3. Solución Propuesta

### Opción A: Usar el logo del frontend como fuente única

1. **Copiar** `apps/front/public/logo.svg` → `apps/back/public/assets/logo.svg`
2. **Crear** `apps/back/public/assets/banner.svg` basado en el logo del frontend (versión horizontal con nombre de la app)
3. **Actualizar** `main.hbs` para usar el nuevo logo: `{{app_url}}/assets/banner.svg`
4. **Unificar** nombre de la app: usar `app_name` config en vez de "MONO" hardcodeado

### Opción B: Servir assets desde el frontend

1. **Configurar** `app_url` para apuntar al frontend (requiere que el frontend esté accesible públicamente)
2. **Subir** el logo al frontend en `public/assets/banner.svg`

**Recomendación**: Opción A (más simple, no depende de que el frontend esté online).

## 4. Checklist

- [ ] Elegir logo definitivo (¿el del frontend o crear uno nuevo?)
- [ ] Si frontend: copiar `logo.svg` a `apps/back/public/assets/`
- [ ] Crear `banner.svg` horizontal con nombre de la app
- [ ] Actualizar `main.hbs` template
- [ ] Verificar que `BACKEND_DOMAIN` apunta al backend correcto
- [ ] Test con Mailpit: verificar que el logo carga en el email
- [ ] Actualizar `docs/modules/email.md` con la nueva ruta

## 5. Riesgos

- **Logo hardcodeado**: "MONO" está en el SVG del backend — hay que reemplazar el archivo
- **CORS**: si el logo se sirve desde el backend y el email se abre en web, sin problema
- **Tamaño**: logos demasiado grandes rompen el layout del email

## 6. Relación con issue #29

Esta issue es dependiente de #29 (Tailwind sync). Una vez que el pipeline de emails funcione, se puede actualizar el layout para incluir el logo correcto.
