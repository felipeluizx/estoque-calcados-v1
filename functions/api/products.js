// functions/api/products.js
import { json, keyProducts } from "../_kv";

export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const facetsOnly = url.searchParams.get("facets") === "1";

  const arr = await env.ESTOQUE_DB.get(keyProducts(), "json") || [];
  if (facetsOnly) {
    const facets = { modelo: new Set(), grade: new Set(), material: new Set(), variacao: new Set() };
    for (const p of arr) {
      if (p.modelo) facets.modelo.add(String(p.modelo).toUpperCase());
      if (p.grade) facets.grade.add(String(p.grade).toUpperCase());
      if (p.material) facets.material.add(String(p.material).toUpperCase());
      if (p.variacao) facets.variacao.add(String(p.variacao).toUpperCase());
    }
    const toArr = s => Array.from(s).sort();
    return json({ ok:true, facets: {
      modelo: toArr(facets.modelo),
      grade: toArr(facets.grade),
      material: toArr(facets.material),
      variacao: toArr(facets.variacao)
    }});
  }
  return json({ ok:true, products: arr });
};
