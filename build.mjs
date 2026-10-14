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

// endereço da API usado pelo painel (vazio = /api do próprio site, ex.: Netlify ou teste local)
writeFileSync('public/config.js', `window.RASTRO_API = ${JSON.stringify(process.env.RASTRO_API || '')};\n`);

// Edge Function do Supabase: API + script embutido
mkdirSync('supabase/functions/rastro', { recursive: true });
await build({
  entryPoints: ['lib/api.mjs'], bundle: true, format: 'esm', platform: 'neutral', target: ['es2022'],
  outfile: 'supabase/functions/rastro/api.js', external: ['node:*'],
  // na Edge Function só existem o postgres.js (injetado pelo index.ts) e o Storage: os outros drivers viram stubs
  plugins: [{
    name: 'stub-drivers',
    setup(b) {
      b.onResolve({ filter: /^(pg|@netlify\/.*|@neondatabase\/.*|npm:.*)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: `throw new Error('indisponível na Edge Function: ${a.path}');`, loader: 'js' }));
    },
  }],
  mainFields: ['module', 'main'], legalComments: 'none', minify: true,
});

for (const f of ['public/t.js', 'public/vendor/vendor.js', 'supabase/functions/rastro/api.js']) console.log(f, (statSync(f).size / 1024).toFixed(1) + ' KB');
