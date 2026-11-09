import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1250,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            return 'three-core';
          }
          if (id.includes('/node_modules/three-stdlib/') || id.includes('/node_modules/three-mesh-bvh/')) {
            return 'three-addons';
          }
          if (id.includes('/node_modules/@react-three/')) {
            return 'r3f-drei';
          }
          if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/motion-')) {
            return 'framer-motion';
          }
        },
      },
    },
  },
});
