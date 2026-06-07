// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Force-enable Nitro deploy support and target Vercel so the build emits
    // a Vercel-compatible server bundle (adapter/preset handled by Nitro).
    // Passing `nitro: true` would also enable it; here we explicitly set the
    // Cloudflare is the default Nitro target for this config; enable the
    // Nitro preset for Cloudflare Workers so the build emits a Cloudflare
    // compatible server bundle.
    nitro: { preset: "cloudflare" },
  },
});
