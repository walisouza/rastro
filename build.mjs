// Gera public/t.js (script de captura) e public/vendor/* (libs do painel)
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from 'node:fs';

mkdirSync('public/vendor', { recursive: true });

await build({
  entryPoints: ['tracker/tracker.js'], bundle: true, minify: true, format: 'iife',
  target: ['es2017'], outfile: 'public/t.js', legalComments: 'none',
});

await build({
  entryPoints: ['dashboard/vendor-entry.js'], bundle: true, minify: true, format: 'iife',
  target: ['es2019'], outfile: 'public/vendor/vendor.js', legalComments: 'none',
  loader: { '.css': 'empty' },
});

copyFileSync('node_modules/rrweb-player/dist/style.min.css', 'public/vendor/player.css');

for (const f of ['public/t.js', 'public/vendor/vendor.js']) console.log(f, (statSync(f).size / 1024).toFixed(1) + ' KB');
