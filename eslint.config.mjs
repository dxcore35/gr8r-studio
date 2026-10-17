import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    'dist/**',
    'out/**',
    'public/upstream/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/**/*.js',
    'vite.config.js',
  ]),
]);
