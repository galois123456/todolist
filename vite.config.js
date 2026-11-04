import { defineConfig } from 'vite';

export default defineConfig({
  // Explicit development-preview host; production Vercel hosting is unchanged.
  server: { allowedHosts: ['terminal.local'] }
});
