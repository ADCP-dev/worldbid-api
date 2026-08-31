import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

// Vite config for WorldBid 3D MVP slice.
// - react plugin for JSX transform
// - tailwindcss v4 vite plugin (no PostCSS config needed)
// - glsl plugin imports .glsl files as strings for the atmosphere ShaderMaterial
export default defineConfig({
  plugins: [react(), tailwindcss(), glsl()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  assetsInclude: ["**/*.geojson"],
});