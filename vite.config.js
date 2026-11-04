import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (!normalizedId.includes("node_modules")) return undefined;

          if (normalizedId.includes("node_modules/react-dom")) return "vendor-react-dom";
          if (normalizedId.includes("node_modules/react")) return "vendor-react";
          if (normalizedId.includes("node_modules/recharts")) return "vendor-recharts";
          if (normalizedId.includes("node_modules/xlsx")) return "vendor-xlsx";
          if (normalizedId.includes("node_modules/@dnd-kit")) return "vendor-dnd-kit";
          if (
            normalizedId.includes("node_modules/@tiptap") ||
            normalizedId.includes("node_modules/prosemirror-")
          ) return "vendor-editor";
          if (
            normalizedId.includes("node_modules/react-hook-form") ||
            normalizedId.includes("node_modules/@hookform") ||
            normalizedId.includes("node_modules/zod")
          ) return "vendor-forms";
          if (normalizedId.includes("node_modules/@tanstack")) return "vendor-tanstack";
          if (normalizedId.includes("node_modules/lucide-react")) return "vendor-lucide";
          if (normalizedId.includes("node_modules/date-fns")) return "vendor-date-fns";
          if (normalizedId.includes("node_modules/framer-motion")) return "vendor-framer";

          return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
