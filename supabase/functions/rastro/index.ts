// Rastro — Edge Function do Supabase (coleta + relatórios). O t.js e o painel ficam em hospedagem estática.
import postgres from 'npm:postgres@3.4.5';
// driver importado de forma estática para o bundler do Supabase incluí-lo
(globalThis as any).__RASTRO_POSTGRES = postgres;
import { handle } from './api.js';

Deno.serve((req: Request) => handle(req));
