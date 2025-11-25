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
6. Crie um namespace **Workers KV** e conecte o binding `KV_BINDING`:
   - Workers & Pages → KV → Create namespace (ex: `estoque-db`).
   - No projeto Pages → Settings → Functions → KV Namespace bindings.
   - Binding name: `KV_BINDING` (preview **e** production) → escolha o namespace recém-criado.
7. Defina o secret `ADMIN_PASSWORD` no Cloudflare Pages:
   - Settings → Environment Variables → Add production variable → "Encrypt" → nome `ADMIN_PASSWORD`.
   - Repita para Preview/Dev. Use uma senha forte: é ela que libera o painel admin.
8. Aplique as migrations no D1 (aba Migrations), na ordem: `migrations/001_init.sql`, `migrations/002_separation_routes.sql` e `migrations/003_route_step_actions.sql`.
9. Abra a URL `https://<project>.pages.dev`. Done!

### Desenvolvimento local (opcional)
- `npm i -g wrangler`
- `wrangler pages dev public --d1=DB=estoque --kv=KV_BINDING=<nome-do-namespace> --binding ADMIN_PASSWORD=<senha>`
- `wrangler d1 execute estoque --local --file=./migrations/001_init.sql`
- `wrangler d1 execute estoque --local --file=./migrations/002_separation_routes.sql`
- `wrangler d1 execute estoque --local --file=./migrations/003_route_step_actions.sql`

### Diagnóstico
- Antes de fazer o deploy definitivo, rode `wrangler pages dev ...` e acesse `http://127.0.0.1:8788/api/estoque?op=ping`.
- A resposta `{"ok":true}` confirma que o binding `KV_BINDING` está disponível (dev e produção).

### Senha do painel admin
- O modal de acesso envia a senha para `/api/admin-login` e recebe um token de sessão curto.
- O token fica salvo em `sessionStorage` (ou em `localStorage` se o usuário marcar “manter sessão”).
- Reponha o secret `ADMIN_PASSWORD` sempre que desejar invalidar as sessões existentes.

## Observações
- O app permite múltiplos produtos por posição.
- Relatórios com multi-seleção, exportar CSV e imprimir.
- Mapa com filtros (Modelo → Grade → Cor) e busca livre.
- PWA básico incluso (instalável no celular).
- Gerador de etiquetas com templates configuráveis, exportação em PDF/PNG e suporte a tiragens customizadas.

## Templates de etiquetas
1. Salve a arte base em `public/assets/templates`. Prefira SVGs (texto puro) para manter o repositório compatível com este fluxo; se precisar usar PNG/JPG, converta para `data:` URL ou hospede externamente. O exemplo `etiqueta-padrao-100x25.svg` tem 1181×295 px ≈ 100×25 mm a 300 DPI.
2. Autentique-se no painel admin para obter o token salvo em `sessionStorage['estoque-admin-token']`.
3. Faça um `POST` para `/api/produtos` contendo os produtos e os templates. Estrutura esperada:

```json
{
  "products": [
    { "id": 1001, "modelo": "Tênis X", "grade": "BAIXA", "material": "Lona", "variacao": "Azul", "sku": "TNX-BA-AZ" }
  ],
  "labelTemplates": [
    {
      "id": "std-100x25",
      "name": "Etiqueta padrão 100×25 mm",
      "artPath": "/assets/templates/etiqueta-padrao-100x25.svg",
      "canvas": { "width": 1181, "height": 295 },
      "fields": [
        {
          "id": "modelo",
          "label": "Modelo",
          "type": "text",
          "source": "modelo",
          "valueTemplate": "{{modelo}}",
          "x": 160,
          "y": 70,
          "font": "700 64px 'Inter', sans-serif",
          "color": "#111827",
          "align": "left",
          "baseline": "alphabetic"
        },
        {
          "id": "tamanho",
          "label": "Numeração",
          "type": "text",
          "source": "tamanho",
          "valueTemplate": "{{tamanho}}",
          "x": 980,
          "y": 170,
          "font": "700 140px 'Inter', sans-serif",
          "color": "#111827",
          "align": "center",
          "baseline": "middle"
        }
      ],
      "qrCodes": [
        {
          "id": "principal",
          "label": "QR principal",
          "size": 220,
          "x": 900,
          "y": 30,
          "dataTemplate": "SKU={{skuCompleto}};SIZE={{tamanho}};GRADE={{gradeTipo}};COR={{variacao}}",
          "correctionLevel": "H"
        }
      ]
    }
  ]
}
```

### Campos suportados
- `valueTemplate` aceita tokens `{{chave}}` com qualquer atributo do produto e variáveis do gerador (`tamanho`, `gradeTipo`, `skuCurto`, `skuCompleto`, `quantidadeAtual`, `quantidadePorTamanho`, `etiquetaExtra`, `produtoId`).
- `fields` definem a posição (`x`, `y`), fonte e alinhamento do texto no canvas.
- `qrCodes` usam o mesmo sistema de template na propriedade `dataTemplate` e aceitam `size`, `x`, `y` e `correctionLevel` (`L`, `M`, `Q`, `H`).

Envie o JSON com `curl` (usando o token Bearer do admin) ou ajuste os dados localmente e utilize o botão “Salvar produtos” para persistir no KV. Depois disso os templates ficam disponíveis no gerador localizado em `#etiquetas`, com suporte a grades pré-configuradas, tiragens unitárias e páginas extras (13/14).

2025-09-13
