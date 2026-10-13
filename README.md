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

Tudo roda no Netlify:

| Parte | Onde |
|---|---|
| Painel + script `t.js` | `public/` (estático) |
| API (coleta e relatórios) | `netlify/functions/api.mjs` → `/api/*` |
| Processamento da fila e limpeza | `netlify/functions/flush.mjs` (agendada a cada 15 min) |
| Métricas | Postgres: Netlify Database ou qualquer Postgres via `DATABASE_URL` |
| Gravações e fila de entrada | Netlify Blobs |

## Como os dados fluem

1. O script `t.js` envia lotes a cada 6s e quando a aba fecha.
2. `/api/collect` guarda o lote numa **fila no Blobs** e não acorda o banco. As gravações vão direto para o Blobs.
3. A function agendada leva a fila para o banco em bloco. Com Netlify Database isso acontece a cada 3h (`HM_FLUSH_MINUTES`). Com `DATABASE_URL`, a cada 15 min.
4. Ao abrir o painel, a fila é processada na hora. Também dá para usar o botão **Atualizar dados**.

Isso existe porque o Netlify Database cobra pelo tempo em que o banco fica acordado. No plano Free o limite é de 48 unidades de computação por mês. Se cada visita gravasse direto no banco, ele nunca dormiria.

## Publicar

1. Suba esta pasta para um repositório no GitHub e importe no Netlify (**Add new project → Import an existing project**). O build já está configurado no `netlify.toml`. Também funciona pela CLI: `npm i && npx netlify deploy --prod`.
2. Em **Project configuration → Environment variables**, crie:
   - `HM_PASSWORD`: senha do painel (obrigatória)
   - `HM_SECRET`: opcional. É uma string aleatória longa usada para assinar o login. Se não existir, a senha é usada no lugar.
3. Escolha o banco:
   - **Netlify Database**: em **Data & Storage → Database**, clique em *Create a database* (ou rode `npx netlify database init`). Ele só existe em contas com plano por créditos.
   - **Postgres externo** (ex.: Supabase grátis): crie `DATABASE_URL` com a connection string. No Supabase, use a do *Transaction pooler*, porta 6543.
4. Faça um novo deploy, abra o site e entre com a senha. As tabelas são criadas sozinhas no primeiro acesso.

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
