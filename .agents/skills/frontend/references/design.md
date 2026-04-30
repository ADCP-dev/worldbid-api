# Frontend Design — Patterns

## Design Thinking Process

Before coding:
1. **Purpose**: Who uses it? What problem?
2. **Tone**: Pick ONE: brutalist, minimal, maximalist, retro, editorial, organic, luxury, etc.
3. **Differentiation**: What makes it UNFORGETTABLE?
4. **Constraints**: Framework, perf, a11y

## Aesthetics Guidelines

| Element | Guideline |
|---------|-----------|
| **Typography** | NO generic (Arial, Inter, Roboto). Pick distinctive character fonts + refined body |
| **Color** | CSS vars for consistency. Dominant colors + sharp accents. Avoid generic purple gradients |
| **Motion** | CSS-first. Staggered reveals (`animation-delay`). Scroll-triggered. Hover states that surprise |
| **Layout** | Asymmetry. Overlap. Diagonal flow. Grid-breaking. Generous negative space |
| **Backgrounds** | Gradient meshes, noise textures, geometric patterns, grain overlays — NOT solid colors |

## NEVER Use

- Inter, Roboto, Arial, system-ui as main fonts
- Purple/blue gradient on white bg
- Space Grotesk every time
- Centered everything with max-w-4xl
- Generic card layouts

## Vue-Specific Patterns

```vue
<script setup lang="ts">
// Use composables for animation
const { motion } = useMotion()
</script>

<template>
  <!-- Staggered entrance -->
  <div v-motion="'fade'" :delay="100" class="...">
  </div>
</template>
```

Always vary theme, colors, fonts between designs. Never converge on same choices.
