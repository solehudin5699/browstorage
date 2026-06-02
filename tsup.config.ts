import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: false,
  minify: true,
  clean: true,
  treeshake: {
    preset: 'smallest',
  },
});
