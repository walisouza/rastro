# Rastro

Rastro é uma ferramenta própria de análise de experiência para os sites dos seus clientes. Ela tem:

- **Mapa de calor** sobre a página real gravada, em cinco modos:
  - cliques
  - movimento do mouse
  - scroll (até onde as pessoas rolam e onde fica a dobra)
  - zonas, com taxa de cliques, exposição, atratividade e tempo de hover por elemento
  - frustração (rage clicks e cliques sem resposta)
- **Session replay** com linha do tempo de páginas, cliques, rage clicks e erros. Todo campo de formulário é mascarado.
- **Jornada** (sankey) dos caminhos entre páginas, com entrada, etapas e saída.
- **Funil** com conversão e abandono em cada etapa.
- **Relatórios** de visão geral, canais, dispositivos, páginas de entrada, erros JS e um comparador de páginas.
- **Agrupamento de páginas**: por exemplo, todos os `/produto/...` contam como "Produto".

## Onde roda

| Parte | Onde |
|---|---|
| Painel + script `t.js` | GitHub Pages, branch `gh-pages` (https://walisouza.github.io/rastro/) |
| API (coleta e relatórios) | Supabase Edge Function `rastro` (código em `lib/`, empacotado em `supabase/functions/rastro/api.js`) |
| Métricas | Postgres do Supabase (tabelas `hm_*`, migração em `supabase/migrations/`) |
| Gravações de sessão | Supabase Storage, bucket privado `rastro-replay` |

A coleta grava cada lote direto no banco. O Supabase fica sempre ligado e não cobra por hora acordada. O script envia a cada 20s e quando a aba fecha, e para de enviar por 6h se a chave do site for inválida.

### Atualizar

1. `RASTRO_API=https://<projeto>.supabase.co/functions/v1/rastro npm run build`
2. Commit e push na `main`. O `index.ts` da function importa o `api.js` deste repositório fixado num commit, então troque o hash no `index.ts` e faça o deploy da function.
3. Publique `public/` na branch `gh-pages`.

A senha do painel fica no banco como hash (`hm_meta.auth_pw_sha256`) ou na variável `HM_PASSWORD` da function.

O código de Netlify (functions, Blobs, Netlify Database) continua no repositório como alternativa, mas os builds no Netlify estão desligados no `netlify.toml`.

## Instalar num site de cliente

Em **Sites e instalação**, cadastre o site, informe os domínios autorizados e copie a linha:

```html
<script src="https://SEU-RASTRO.netlify.app/t.js" data-key="CHAVE-DO-SITE" defer></script>
```

- **WordPress**: WPCode → Header, ou no `header.php` do tema.
- **Subsplash / Lovable / HTML**: no campo de código do `<head>`.
- Para respeitar o "Do Not Track" do navegador, adicione `data-dnt="respect"`.
- Para esconder um trecho das gravações, use a classe `rastro-mask` (o texto vira asteriscos). Para nem gravar o elemento, use `rastro-block`.
- Para desligar o rastreio num acesso seu, abra o site com `?rastro_off` na URL.

### LGPD

O script não usa cookies (usa `localStorage`), não guarda IP e mascara todos os campos de formulário. Mesmo assim, mencione a ferramenta na política de privacidade de cada cliente. Se o site tiver banner de consentimento, carregue o script só depois do aceite.

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `HM_PASSWORD` | Senha do painel |
| `HM_SECRET` | Chave de assinatura do login (opcional) |
| `DATABASE_URL` | Usa um Postgres externo no lugar do Netlify Database |
| `HM_FLUSH_MINUTES` | Intervalo de processamento da fila (padrão: 180 com Netlify Database, 15 com `DATABASE_URL`) |

## Desenvolvimento local

```bash
npm install
npm run build          # gera public/t.js e public/vendor/*
npm test               # teste ponta a ponta com Chromium + Postgres em memória (PGlite)
node test/server.mjs   # painel local em http://localhost:8899 (senha: teste123)
```

O teste abre um site falso (`test/site/`) com o script e simula visitas, cliques, rage clicks, scroll e navegação. Depois confere a fila, o banco, o mapa de calor, o replay (incluindo a máscara de campos), a jornada, o funil e o bloqueio de domínio.
