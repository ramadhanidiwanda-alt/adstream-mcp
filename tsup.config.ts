import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/mcp/index.ts', 'src/mcp/http.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  onSuccess: 'tsc --declaration --emitDeclarationOnly --outDir dist',
});
