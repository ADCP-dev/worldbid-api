---
name: daisyui
description: Tailwind CSS component library with 50+ semantic class components for Foundation UI. Use for ALL frontend styling — cards, buttons, forms, modals, tables, badges, dropdowns, avatars, tooltips, progress, alerts, chat bubbles, accordions, tabs, navbars.
---

# DaisyUI Skill — Foundation UI

DaisyUI es la librería de componentes CSS del proyecto. Todos los componentes de Foundation usan clases DaisyUI + Tailwind. Este skill cubre TODOS los componentes que podrías necesitar.

## Principios

1. **NO escribir CSS custom** si DaisyUI ya tiene un componente para eso
2. **Usar clases semánticas**: `btn`, `card`, `modal`, `badge`, `input`, `select`, `textarea`, `toggle`, `checkbox`, `alert`, `tooltip`, `dropdown`, `avatar`, `progress`, `chat`, `collapse`, `tabs`, `menu`, `navbar`, `drawer`, `breadcrumbs`, `divider`, `hero`, `loading`, `steps`, `timeline`, `skeleton`, `countdown`, `carousel`, `range`, `rating`
3. **Temas**: Foundation usa temas DaisyUI con `data-theme`. Los colores son `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`, `error`
4. **Responsive**: Usar prefijos Tailwind `sm:`, `md:`, `lg:`

---

## Componentes

### Cards
```html
<!-- Card estándar Foundation -->
<div class="card bg-base-100 shadow-sm border">
  <div class="card-body">
    <h2 class="card-title">Título</h2>
    <p>Contenido</p>
    <div class="card-actions">
      <button class="btn btn-primary">Acción</button>
    </div>
  </div>
</div>

<!-- Variantes: card-compact, card-side, card-bordered, image-full -->
<div class="card card-compact bg-base-100 shadow-sm border">
  <div class="card-body p-3">Compacto</div>
</div>
```

### Buttons
```html
<!-- Tamaños: btn-lg, btn, btn-sm, btn-xs -->
<!-- Colores: btn-primary, btn-secondary, btn-accent, btn-neutral, btn-info, btn-success, btn-warning, btn-error -->
<!-- Estilos: btn-ghost, btn-outline, btn-link, btn-active, btn-disabled -->
<!-- Formas: btn-circle, btn-square, btn-wide, btn-block -->

<button class="btn btn-primary">Primary</button>
<button class="btn btn-ghost btn-sm">Ghost Small</button>
<button class="btn btn-outline btn-error btn-xs">Error Outline XS</button>
<button class="btn btn-circle btn-sm">X</button>
<button class="btn btn-primary" :disabled="loading">
  <span v-if="loading" class="loading loading-spinner loading-xs" />
  {{ loading ? 'Guardando...' : 'Guardar' }}
</button>
```

### Forms
```html
<!-- Input -->
<input class="input input-bordered w-full" placeholder="..." />
<input class="input input-bordered input-sm" />
<input class="input input-bordered input-xs" />
<input class="input input-error" /> <!-- error state -->

<!-- Select -->
<select class="select select-bordered w-full">
  <option value="">Seleccionar...</option>
  <option value="1">Option 1</option>
</select>

<!-- Textarea -->
<textarea class="textarea textarea-bordered w-full" rows="3" placeholder="..."></textarea>

<!-- Checkbox / Radio -->
<input type="checkbox" class="checkbox checkbox-primary" />
<input type="radio" class="radio radio-primary" />

<!-- Toggle -->
<input type="checkbox" class="toggle toggle-primary" />

<!-- Range -->
<input type="range" class="range range-primary" min="0" max="100" />

<!-- Rating (estrellas) -->
<div class="rating">
  <input type="radio" class="mask mask-star bg-orange-400" />
  <input type="radio" class="mask mask-star bg-orange-400" checked />
</div>

<!-- File input -->
<input type="file" class="file-input file-input-bordered w-full" />

<!-- Form control wrapper -->
<label class="form-control w-full">
  <div class="label"><span class="label-text">Label</span><span class="label-text-alt">Alt</span></div>
  <input class="input input-bordered" />
  <div class="label"><span class="label-text-alt text-error">Error message</span></div>
</label>
```

### Modals
```html
<!-- Usando <dialog> con Vue (recomendado) -->
<dialog ref="modalRef" class="modal" :class="{ 'modal-open': isOpen }">
  <div class="modal-box max-w-2xl"> <!-- max-w-2xl, max-w-3xl, max-w-5xl -->
    <h3 class="font-bold text-lg mb-4">Título</h3>
    <div class="space-y-4"><!-- contenido --></div>
    <div class="modal-action">
      <button class="btn btn-primary" @click="save">Guardar</button>
      <button class="btn" @click="isOpen = false">Cerrar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop" @click="isOpen = false">
    <button>close</button>
  </form>
</dialog>

<!-- Responsive: modal-bottom sm:modal-middle -->
```

### Badges
```html
<span class="badge">Default</span>
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-accent">Accent</span>
<span class="badge badge-ghost">Ghost</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-outline">Outline</span>
<!-- Tamaños: badge-sm, badge-xs, badge-lg -->
```

### Dropdowns
```html
<!-- Básico (click) -->
<div class="dropdown">
  <button tabindex="0" class="btn btn-ghost btn-xs">···</button>
  <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-40 z-50 border border-base-300">
    <li><button @click="ver">👁️ Ver</button></li>
    <li><button @click="editar">✏️ Editar</button></li>
    <li><button class="text-error" @click="borrar">🗑️ Eliminar</button></li>
  </ul>
</div>

<!-- Posiciones: dropdown-end, dropdown-top, dropdown-bottom, dropdown-left, dropdown-right -->
<!-- Hover: dropdown-hover -->
<!-- Abierto: dropdown-open -->
```

### Avatars
```html
<!-- Con imagen -->
<div class="avatar">
  <div class="w-8 rounded-full"><img src="url" alt="Avatar" /></div>
</div>

<!-- Con iniciales -->
<div class="avatar placeholder">
  <div class="bg-neutral text-neutral-content rounded-full w-8"><span>JD</span></div>
</div>

<!-- Grupo -->
<div class="avatar-group -space-x-2">
  <div class="avatar"><div class="w-8"><img /></div></div>
</div>

<!-- Tamaños: w-6, w-8, w-10, w-12, w-16, w-24 -->
<!-- Online indicator: <div class="avatar online"> -->
<!-- Offline: <div class="avatar offline"> -->
```

### Tooltips
```html
<!-- Posiciones: tooltip-top, tooltip-bottom, tooltip-left, tooltip-right -->
<div class="tooltip" data-tip="Tooltip text">Hover me</div>
<div class="tooltip tooltip-right" data-tip="Right">Hover</div>

<!-- Colores: tooltip-primary, tooltip-info, tooltip-success, tooltip-warning, tooltip-error -->
```

### Progress
```html
<progress class="progress progress-primary w-full" value="75" max="100"></progress>
<progress class="progress progress-success w-full" value="100" max="100"></progress>

<!-- Indeterminate (sin value) -->
<progress class="progress progress-primary w-full"></progress>

<!-- Radial progress -->
<div class="radial-progress text-primary" style="--value:75">75%</div>
```

### Alerts
```html
<div class="alert alert-info">
  <svg><!-- icon --></svg>
  <span>Info message</span>
</div>

<div class="alert alert-success">
  <span>¡Operación exitosa!</span>
  <button class="btn btn-sm btn-ghost">X</button>
</div>

<div class="alert alert-warning">Warning</div>
<div class="alert alert-error">Error message</div>
```

### Loading / Spinners
```html
<span class="loading loading-spinner text-primary"></span>
<span class="loading loading-spinner loading-xs"></span>
<span class="loading loading-spinner loading-sm"></span>
<span class="loading loading-spinner loading-md"></span>
<span class="loading loading-spinner loading-lg"></span>

<!-- Variantes: loading-dots, loading-ring, loading-ball, loading-bars, loading-infinity -->
```

### Chat Bubbles
```html
<div class="chat chat-start">
  <div class="chat-image avatar"><div class="w-8 rounded-full"><img /></div></div>
  <div class="chat-header">Nombre <time class="text-xs opacity-50">12:00</time></div>
  <div class="chat-bubble">Mensaje</div>
  <div class="chat-footer opacity-50">Entregado</div>
</div>

<div class="chat chat-end">
  <div class="chat-bubble chat-bubble-primary">Mi mensaje</div>
</div>
```

### Accordion / Collapse
```html
<!-- Con input (radio/checkbox) -->
<div class="collapse collapse-arrow bg-base-100 border border-base-300">
  <input type="checkbox" />
  <div class="collapse-title font-semibold">Título</div>
  <div class="collapse-content"><p>Contenido</p></div>
</div>

<!-- Con <details> -->
<details class="collapse collapse-arrow bg-base-100 border border-base-300" open>
  <summary class="collapse-title font-semibold">Título</summary>
  <div class="collapse-content"><p>Contenido</p></div>
</details>

<!-- Estilos: collapse-arrow, collapse-plus -->
<!-- Variantes: collapse-open (siempre abierto), collapse-close (siempre cerrado) -->
<!-- Agrupados: join join-vertical con collapse join-item -->
```

### Tabs
```html
<!-- Tabs básicos -->
<div class="tabs">
  <a class="tab tab-bordered" :class="{ 'tab-active': activeTab === 1 }">Tab 1</a>
  <a class="tab tab-bordered" :class="{ 'tab-active': activeTab === 2 }">Tab 2</a>
</div>

<!-- Tabs boxed -->
<div class="tabs tabs-boxed">
  <a class="tab tab-active">Tab 1</a>
  <a class="tab">Tab 2</a>
</div>

<!-- Tabs lifted (con borde inferior) -->
<div class="tabs tabs-lifted">
  <a class="tab tab-active">Tab 1</a>
</div>
```

### Stats
```html
<div class="stats shadow">
  <div class="stat">
    <div class="stat-figure text-primary"><Icon /></div>
    <div class="stat-title">Total</div>
    <div class="stat-value text-primary">89,400</div>
    <div class="stat-desc text-sm">↗︎ 12% más que ayer</div>
    <div class="stat-actions"><button class="btn btn-sm">Ver</button></div>
  </div>
</div>

<!-- Horizontal: stats stats-horizontal -->
<!-- Vertical (default): stats stats-vertical -->
```

### Navbar
```html
<div class="navbar bg-base-100 border-b border-base-300">
  <div class="navbar-start">
    <a class="btn btn-ghost text-xl">Logo</a>
  </div>
  <div class="navbar-center">
    <ul class="menu menu-horizontal px-1">
      <li><a>Item 1</a></li>
      <li><a>Item 2</a></li>
    </ul>
  </div>
  <div class="navbar-end">
    <button class="btn btn-ghost btn-circle">🔔</button>
  </div>
</div>
```

### Drawer (sidebar)
```html
<div class="drawer lg:drawer-open">
  <input id="drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content"><!-- contenido principal --></div>
  <div class="drawer-side">
    <label for="drawer" class="drawer-overlay"></label>
    <ul class="menu p-4 w-64 min-h-full bg-base-200">
      <li><a>Sidebar Item</a></li>
    </ul>
  </div>
</div>
```

### Menu
```html
<ul class="menu bg-base-200 rounded-box w-64">
  <li><a>Item</a></li>
  <li class="menu-title">Category</li>
  <li><a>Sub item</a></li>
  <li>
    <details open>
      <summary>Parent</summary>
      <ul><li><a>Child</a></li></ul>
    </details>
  </li>
  <li class="disabled"><a>Disabled</a></li>
</ul>

<!-- Horizontal: menu menu-horizontal -->
<!-- Tamaños: menu-xs, menu-sm, menu-md, menu-lg -->
```

### Breadcrumbs
```html
<div class="breadcrumbs text-sm">
  <ul>
    <li><a>Home</a></li>
    <li><a>Documents</a></li>
    <li>Add Document</li>
  </ul>
</div>
```

### Steps
```html
<ul class="steps">
  <li class="step step-primary">Register</li>
  <li class="step step-primary">Choose plan</li>
  <li class="step">Purchase</li>
  <li class="step">Receive</li>
</ul>

<!-- Vertical: steps steps-vertical -->
<!-- Responsive: steps steps-vertical lg:steps-horizontal -->
<!-- Con data-content: <li data-content="✓" class="step step-primary"> -->
```

### Timeline
```html
<ul class="timeline timeline-vertical">
  <li>
    <div class="timeline-start">1984</div>
    <div class="timeline-middle"><svg><!-- icon --></svg></div>
    <div class="timeline-end timeline-box">First Mac</div>
  </li>
  <li><hr /><!-- ... --></li>
</ul>

<!-- Horizontal: timeline timeline-horizontal -->
<!-- Compact: timeline-compact -->
```

### Skeleton (loading placeholder)
```html
<div class="flex flex-col gap-4">
  <div class="skeleton h-4 w-full"></div>
  <div class="skeleton h-4 w-3/4"></div>
  <div class="skeleton h-32 w-full"></div>
  <div class="skeleton h-8 w-28"></div>
</div>
```

### Countdown
```html
<span class="countdown font-mono text-2xl">
  <span style="--value:10"></span>:<span style="--value:24"></span>:<span style="--value:00"></span>
</span>
```

### Carousel
```html
<div class="carousel w-full">
  <div id="slide1" class="carousel-item w-full"><img src="..." /></div>
  <div id="slide2" class="carousel-item w-full"><img src="..." /></div>
</div>
<div class="flex justify-center gap-2">
  <a href="#slide1" class="btn btn-xs">1</a>
  <a href="#slide2" class="btn btn-xs">2</a>
</div>

<!-- Snap: carousel carousel-center carousel-vertical -->
<!-- Indicators: carousel carousel-end -->
```

### Divider
```html
<div class="divider">OR</div>
<div class="divider divider-primary">Primary</div>
<div class="divider divider-start">Left</div>
<div class="divider divider-end">Right</div>
```

### Footer
```html
<footer class="footer bg-base-200 p-10">
  <nav><h6 class="footer-title">Services</h6><a>Link</a></nav>
  <nav><h6 class="footer-title">Company</h6><a>Link</a></nav>
</footer>
<footer class="footer footer-center bg-base-300 p-4">
  <aside><p>Copyright © 2025</p></aside>
</footer>
```

### Hero
```html
<div class="hero min-h-screen bg-base-200">
  <div class="hero-content text-center">
    <div class="max-w-md">
      <h1 class="text-5xl font-bold">Hello there</h1>
      <p class="py-6">Description</p>
      <button class="btn btn-primary">Get Started</button>
    </div>
  </div>
</div>
```

### Table (HTML)
```html
<div class="overflow-x-auto">
  <table class="table table-zebra">
    <thead><tr><th>Name</th><th>Role</th></tr></thead>
    <tbody><tr><td>John</td><td>Admin</td></tr></tbody>
  </table>
</div>

<!-- Variantes: table-xs, table-sm, table-md, table-lg -->
<!-- Pin rows/cols: table-pin-rows table-pin-cols -->
```

### Join (group elements)
```html
<div class="join">
  <button class="btn join-item">1</button>
  <button class="btn join-item btn-active">2</button>
  <button class="btn join-item">3</button>
</div>

<div class="join join-vertical">
  <div class="collapse collapse-arrow join-item border border-base-300">...</div>
</div>

<!-- Horizontal (default): join -->
<!-- Vertical: join join-vertical -->
```

### Mask (image clipping)
```html
<img class="mask mask-squircle" src="..." />
<img class="mask mask-heart" src="..." />
<img class="mask mask-star" src="..." />
<!-- Variantes: mask-circle, mask-hexagon, mask-triangle, mask-parallelogram, mask-diamond -->
```

### Filter (CSS filters)
```html
<img class="filter blur-sm" src="..." />
<img class="filter grayscale" src="..." />
<img class="filter sepia" src="..." />
```

---

## Colores y Estados

| Clase | Uso |
|-------|-----|
| `bg-base-100` | Fondo principal |
| `bg-base-200` | Fondo secundario (hover, sidebar) |
| `bg-base-300` | Bordes, separadores |
| `text-base-content` | Texto principal |
| `text-base-content/60` | Texto secundario (60% opacidad) |
| `text-base-content/40` | Texto terciario (placeholder) |
| `border-base-300` | Bordes estándar |
| `bg-primary/10` | Fondo primary al 10% (highlight sutil) |
| `bg-primary/20` | Fondo primary al 20% (highlight visible) |
| `ring-2 ring-primary ring-inset` | Anillo primary para selección |
| `text-primary`, `text-success`, `text-warning`, `text-error` | Texto de color |
| `bg-success/20`, `bg-warning/20`, `bg-error/20` | Fondos de estado suaves |

---

## Layout Patterns

```html
<!-- Grid responsive -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

<!-- Flex con space -->
<div class="flex items-center justify-between gap-4">

<!-- Container Foundation -->
<div class="container mx-auto py-8 max-w-7xl">

<!-- Card con DataTable (patrón común) -->
<div class="card bg-base-100 shadow-sm border">
  <div class="card-body">
    <div class="flex justify-between items-center mb-4">
      <h2 class="card-title text-lg">Título</h2>
      <button class="btn btn-primary btn-sm">Acción</button>
    </div>
    <DataTable ... />
  </div>
</div>

<!-- Page header -->
<div class="flex justify-between items-center mb-8">
  <div class="flex items-center gap-4">
    <NuxtLink to="/app/page" class="btn btn-ghost btn-sm">←</NuxtLink>
    <h1 class="text-3xl font-bold">Título</h1>
  </div>
  <NuxtLink to="/app/page/create" class="btn btn-primary">Crear</NuxtLink>
</div>
```

---

## Interacciones y Estados

| Situación | Clases |
|-----------|--------|
| Hover sutil | `hover:bg-base-200 transition-colors` |
| Hover sombra | `hover:shadow-md transition-shadow` |
| Card clickeable | `cursor-pointer hover:shadow-md transition-shadow` |
| Deshabilitado | `opacity-50 pointer-events-none` |
| Loading button | `btn btn-primary` + `<span class="loading loading-spinner loading-xs" />` |
| Active/Nav | `tab-active`, `btn-active`, `menu :where(li > *)` |
| Error input | `input input-bordered input-error` |
| Ghost (drag) | `opacity-30 scale-105 shadow-xl` |

---

## Foundation-Specific Patterns

### Formulario con Card
```html
<form @submit.prevent="onSubmit" class="space-y-6">
  <div class="card bg-base-100 shadow-sm border">
    <div class="card-body">
      <h3 class="card-title text-lg border-b pb-2 mb-4">Sección</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput v-model="form.name" label="Nombre" required :error="errors.name" />
        <FormInput v-model="form.slug" label="Slug" required />
      </div>
    </div>
  </div>
  <div class="flex gap-4">
    <button class="btn btn-primary" :disabled="loading">
      <span v-if="loading" class="loading loading-spinner loading-xs" />
      {{ loading ? 'Guardando...' : 'Guardar' }}
    </button>
    <NuxtLink to="/app/page" class="btn btn-ghost">Cancelar</NuxtLink>
  </div>
</form>
```

### Empty State
```html
<div class="text-center py-12 text-base-content/60">
  <svg class="w-12 h-12 mx-auto mb-4 opacity-40">...</svg>
  <p class="text-lg">No hay datos</p>
  <p class="text-sm">Crea tu primer registro para empezar</p>
</div>
```

### Error Message
```html
<div v-if="error" class="alert alert-error">
  <span>{{ error }}</span>
</div>
```

---

## Reglas de Oro

1. NUNCA escribir `<style scoped>` si DaisyUI tiene el componente
2. Usar `shadow-sm border` en cards (estilo Foundation)
3. Usar `hover:bg-base-200 transition-colors` para interacciones
4. Usar `opacity-50` para estados disabled/inactivos
5. Usar `truncate` con `min-w-0` para texto que se corta
6. Espaciados: `p-4`, `gap-4`, `space-y-4`, `mb-4`
7. Texto secundario: `text-base-content/60`, terciario: `text-base-content/40`
8. Para iconos: usar `lucide-vue-next` (NO emojis como iconos funcionales)
9. Formularios: usar componentes `@base/ui-app/components/form/` (FormInput, FormSelect, etc.)
10. Tablas: usar `DataTable` de `@base/ui-app/components/data-table/`
