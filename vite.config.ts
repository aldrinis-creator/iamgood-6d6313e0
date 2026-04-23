import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(Date.now().toString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.ico", "robots.txt"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "Check-iN — Personal Emergency Response",
        short_name: "Check-iN",
        description: "Personal Emergency Response System with medication reminders, check-ins, and guardian alerts.",
        theme_color: "#1a3a5c",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const after = id.split('node_modules/').pop()!;
          const pkg = after.startsWith('@')
            ? after.split('/').slice(0, 2).join('/')
            : after.split('/')[0];

          // React + every react-* peer in one chunk to guarantee init order
          if (
            pkg === 'react' ||
            pkg === 'react-dom' ||
            pkg === 'scheduler' ||
            pkg.startsWith('react-')
          ) return 'vendor-react';

          if (pkg.startsWith('@radix-ui') || pkg === 'lucide-react' || pkg === 'cmdk') return 'vendor-ui';
          if (pkg.startsWith('@supabase')) return 'vendor-supabase';
          if (pkg.startsWith('@tanstack')) return 'vendor-query';
          // Note: do NOT manualChunk recharts/d3 — let Rollup co-locate them with their dynamic-import callers.
          // Manual chunking caused a circular-init crash ("Cannot access 'A' before initialization") on first load.
          if (pkg === 'pdfjs-dist' || pkg === 'jspdf' || pkg === 'html2canvas') return 'vendor-pdf';
          if (pkg === 'leaflet') return 'vendor-maps';
          if (pkg === 'date-fns' || pkg === 'zod') return 'vendor-forms';
          return 'vendor-misc';
        },
      },
    },
  },
}));
