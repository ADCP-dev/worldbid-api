/**
 * Lazy-load GSAP and its ScrollTrigger plugin from the client.
 *
 * Why: importing `gsap` at the top of <script setup> pulls the full GSAP
 * bundle into the initial JS payload. By importing it dynamically inside
 * `onMounted`, Rollup code-splits it into a separate chunk that is fetched
 * only after hydration, reducing TBT and the main-thread work on first paint.
 */
// Este composable tendría que estar en landing
// export async function loadGsap(): Promise<typeof import('gsap')> {
//   const mod = await import('gsap')
//   return mod
// }

// export async function loadScrollTrigger(): Promise<typeof import('gsap/ScrollTrigger')> {
//   const mod = await import('gsap/ScrollTrigger')
//   return mod
// }
