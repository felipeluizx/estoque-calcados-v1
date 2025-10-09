// functions/api/map.js
import { json } from "../_kv";

export const onRequestGet = async ({ env }) => {
  const byLoc = {};
  let cursor;
  do {
    const page = await env.ESTOQUE_DB.list({ prefix: "inv:", cursor });
    cursor = page.cursor;
    for (const k of page.keys) {
      const val = await env.ESTOQUE_DB.get(k.name, "json");
      if (!val) continue;
      const loc = String(val.locationId).toUpperCase();
      const arr = byLoc[loc] || [];
      arr.push({ productId: val.productId, quantity: val.quantity, lastAccess: val.lastAccess });
      byLoc[loc] = arr;
    }
  } while (cursor);

  const list = Object.keys(byLoc).sort().map(loc => {
    const total = byLoc[loc].reduce((a,b)=>a+Number(b.quantity||0),0);
    return { locationId: loc, total, items: byLoc[loc] };
  });

  return json({ ok:true, locations: list });
};
