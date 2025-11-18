# Estoque Calçados (Cloudflare Pages + Functions + D1)

Pronto para deploy **grátis**.

## Estrutura
- `public/` → seu front-end (index.html)
- `functions/api` → rotas da API (Pages Functions)
- `migrations/001_init.sql` → schema do D1 (SQLite)
- `wrangler.toml` → config local

## Deploy
1. Suba este repositório no GitHub.
2. No Cloudflare → Workers & Pages → **Pages → Create Project** → conecte o repo.
3. Build:
   - Framework: None
   - Build command: *(vazio)*
   - Output directory: `public`
4. Pages Functions: habilitadas por padrão (pasta `functions/`).
5. Crie o **D1** (Database) no painel e faça o **binding**:
   - Settings → Functions → D1 Bindings
   - Binding name: `DB` (exatamente)
   - Database: escolha o D1 criado
6. Crie um namespace **Workers KV** e conecte o binding `ESTOQUE_DB`:
   - Workers & Pages → KV → Create namespace (ex: `estoque-db`).
   - No projeto Pages → Settings → Functions → KV Namespace bindings.
   - Binding name: `ESTOQUE_DB` (preview **e** production) → escolha o namespace recém-criado.
7. Aplique a migration `migrations/001_init.sql` no D1 (aba Migrations).
8. Abra a URL `https://<project>.pages.dev`. Done!

### Desenvolvimento local (opcional)
- `npm i -g wrangler`
- `wrangler pages dev public --d1=DB=estoque --kv=ESTOQUE_DB=<nome-do-namespace>`
- `wrangler d1 execute estoque --local --file=./migrations/001_init.sql`

### Diagnóstico
- Antes de fazer o deploy definitivo, rode `wrangler pages dev ...` e acesse `http://127.0.0.1:8788/api/estoque?op=ping`.
- A resposta `{"ok":true}` confirma que o binding `ESTOQUE_DB` está disponível (dev e produção).

## Observações
- O app permite múltiplos produtos por posição.
- Relatórios com multi-seleção, exportar CSV e imprimir.
- Mapa com filtros (Modelo → Grade → Cor) e busca livre.
- PWA básico incluso (instalável no celular).

2025-09-13
