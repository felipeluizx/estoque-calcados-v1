// functions/_kv.js
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" };
export const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers });

export function keyInv(locationId, productId){
  return `inv:${String(locationId).toUpperCase()}:${Number(productId)}`;
}
export function keyOrder(id){ return `order:${id}`; }
export function keyOrdersIndex(){ return `orders:index`; }
export function keyProducts(){ return `products`; }

export function keyHist(dateIso){
  const d = new Date(dateIso||Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const rid = (crypto.randomUUID?.() || (Date.now()+"-"+Math.random().toString(16).slice(2)));
  return `hist:${y}${m}${day}:${rid}`;
}

export async function addHistory(env, type, details){
  const key = keyHist(new Date().toISOString());
  const payload = { date: new Date().toISOString(), type, details };
  await env.ESTOQUE_DB.put(key, JSON.stringify(payload), { expirationTtl: 60*60*24*90 });
}

export async function listInventory(env, prefixCol=null){
  const prefix = "inv:" + (prefixCol ? String(prefixCol).toUpperCase() : "");
  const out = [];
  let cursor;
  do {
    const page = await env.ESTOQUE_DB.list({ prefix, cursor });
    cursor = page.cursor;
    for (const k of page.keys) {
      if (!k.name.startsWith("inv:")) continue;
      const val = await env.ESTOQUE_DB.get(k.name, "json");
      if (val) out.push(val);
    }
  } while (cursor);
  return out;
}

export function parseCol(locationId){
  return String(locationId||"").split("-")[0].trim().toUpperCase();
}
export function parseSlot(locationId){
  return String(locationId||"").split("-")[1]?.trim().toUpperCase() || "";
}
export function slotRank(locationId){
  const s = parseSlot(locationId);
  if (s === "FRENTE") return 0;
  if (s === "MEIO")   return 1;
  return 2;
}
