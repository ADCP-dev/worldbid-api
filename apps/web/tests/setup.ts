// Vitest global setup.
// jsdom lacks WebGL; globe.gl/THREE modules that touch WebGL are mocked at the
// test level (per-test vi.mock). This file only registers jest-dom matchers.
import "@testing-library/jest-dom/vitest";