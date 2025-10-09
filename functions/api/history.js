// functions/api/history.js  (KV-only)
export async function onRequestGet({ env }) {
  const out = [];
  let cursor;
  do {
    const page = await env.ESTOQUE_DB.list({ prefix: "hist:", cursor });
    cursor = page.cursor;
    for (const k of page.keys) {
      const val = await env.ESTOQUE_DB.get(k.name, "json");
      if (val) out.push(val);
    }
  } while (cursor);
  out.sort((a,b)=> new Date(b.date) - new Date(a.date));
  return new Response(JSON.stringify(out.slice(0,500)), { status:200, headers:{ "content-type":"application/json; charset=utf-8" } });
}
