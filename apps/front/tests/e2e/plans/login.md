# E2E Test Plan — Auth: Login

## Feature
Inicio de sesión con email y contraseña en el frontend Nuxt.

## Test Cases

### TC1: Login exitoso con credenciales válidas
- **Given** usuario registrado con email `admin@example.com` y password `secret`
- **When** navega a `/login`, ingresa credenciales, presiona submit
- **Then** redirige a home/dashboard, muestra toast de éxito

### TC2: Login fallido con credenciales inválidas
- **Given** usuario no registrado o contraseña incorrecta
- **When** navega a `/login`, ingresa `fake@test.com` / `wrongpass`, presiona submit
- **Then** muestra toast de error, permanece en `/login`

### TC3: Validación de campos vacíos
- **Given** formulario de login
- **When** presiona submit sin llenar email ni password
- **Then** muestra toast de error "campos vacíos"

### TC4: Navegación a registro desde login
- **Given** página de login
- **When** hace clic en link de registro
- **Then** navega a `/register`

## Implementation Notes
- URL base: `http://localhost:3000`
- Selectores: `input[type="email"]`, `input[type="password"]`, `button[type="submit"]`
- Toast: `vue-sonner` muestra `[data-sonner-toast]`
