import { build } from 'esbuild';

await build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [
    'express',
    'fs', 'path', 'url', 'stream', 'events', 'os',
    'crypto', 'http', 'https', 'net', 'tls', 'zlib',
    'buffer', 'util', 'querystring', 'string_decoder',
  ],
  logLevel: 'info',
});
