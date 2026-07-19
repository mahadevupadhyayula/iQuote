import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals.js';
import nextTypescript from 'eslint-config-next/typescript.js';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
    'supabase/.temp/**',
  ]),
]);
