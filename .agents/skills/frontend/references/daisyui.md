# DaisyUI — Key Classes Reference

## Buttons

`btn` `btn-primary` `btn-secondary` `btn-accent` `btn-ghost` `btn-link`
`btn-lg` `btn-sm` `btn-xs` `btn-circle` `btn-square` `btn-wide` `btn-block`
`btn-outline` `btn-active` `btn-disabled` `loading`

## Cards

```html
<div class="card bg-base-100 shadow-xl">
  <figure><img src="..." /></figure>
  <div class="card-body">
    <h2 class="card-title">Title</h2>
    <p>Content</p>
    <div class="card-actions justify-end">
      <button class="btn btn-primary">Action</button>
    </div>
  </div>
</div>
```

`card-compact` `image-full`

## Forms

`input input-bordered input-primary` `input-lg` `input-sm` `input-xs`
`textarea textarea-bordered`
`select select-bordered`
`checkbox` `checkbox-primary`
`radio` `radio-primary`
`toggle` `toggle-primary`
`range range-primary`
`file-input file-input-bordered`
`form-control` `label` `label-text` `label-text-alt`

## Modals

```html
<dialog id="my_modal" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Title</h3>
    <p class="py-4">Content</p>
    <div class="modal-action">
      <form method="dialog"><button class="btn">Close</button></form>
    </div>
  </div>
</dialog>
```

`modal-bottom sm:modal-middle` (responsive)

## Navigation

`navbar` `navbar-start` `navbar-center` `navbar-end`
`menu menu-horizontal` with `menu-title` `menu-dropdown`
`breadcrumbs`
`tabs tabs-boxed` `tab tab-active`
`join` `join-item` (pagination)

## Layout

`drawer` `drawer-toggle` `drawer-content` `drawer-side` `drawer-overlay`
`drawer-mobile` (sidebar always visible desktop)
`hero` `hero-content`
`footer`
`stack`
`divider`

## Data Display

`table` `table-zebra` `table-pin-rows` `table-pin-cols`
`badge` `badge-primary` `badge-secondary` `badge-outline` `badge-ghost`
`stats` `stat` `stat-title` `stat-value` `stat-desc`
`timeline` `timeline-start` `timeline-middle` `timeline-end`
`avatar` `avatar-group`
`progress progress-primary`
`radial-progress`

## Feedback

`alert` `alert-success` `alert-warning` `alert-error` `alert-info`
`toast` `toast-top` `toast-end` `toast-center`
`loading loading-spinner` `loading-dots` `loading-ring` `loading-infinity`
`tooltip` `tooltip-right` `tooltip-top` `tooltip-bottom` `data-tip="text"`

## Semantic Colors

**Background:** `bg-primary` `bg-secondary` `bg-accent` `bg-neutral`
`bg-base-100` `bg-base-200` `bg-base-300`
`bg-info` `bg-success` `bg-warning` `bg-error`

**Text:** `text-primary` `text-primary-content` `text-secondary`
`text-base-content` `text-neutral-content`
`text-info` `text-success` `text-warning` `text-error`

## Themes

Add to `tailwind.config.js`: `plugins: [require("daisyui")]`
Switch: `document.documentElement.setAttribute('data-theme', 'dark')`
30+ themes: `light`, `dark`, `cupcake`, `synthwave`, `retro`, `cyberpunk`, etc.

## CSS Variables

`--rounded-box` `--rounded-btn` `--rounded-badge`
`--animation-btn` `--animation-input`
`--btn-text-case` `--btn-focus-scale`
`--border-btn` `--tab-border` `--tab-radius`
