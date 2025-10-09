// functions/api/orders.js  (KV-only)
import { json, addHistory, keyOrder, keyOrdersIndex } from "../_kv";

function orderRef(cliente){
  const now = new Date();
  const aa = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const dd = String(now.getDate()).padStart(2,'0');
  const hh = String(now.getHours()).padStart(2,'0');
  const mi = String(now.getMinutes()).padStart(2,'0');
  const cli = String(cliente||'').normalize('NFD').replace(/\p{Diacritic}+/gu,'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  return `${aa}${mm}${dd}-${cli}-${hh}${mi}`;
}

async function listIds(env){
  const ids = await env.ESTOQUE_DB.get(keyOrdersIndex(), "json");
  return Array.isArray(ids) ? ids : [];
}
async function saveIds(env, ids){
  await env.ESTOQUE_DB.put(keyOrdersIndex(), JSON.stringify(ids));
}

export const onRequest = async ({ env, request }) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname === "/api/orders" && method === "GET") {
    const ids = await listIds(env);
    const orders = [];
    for (const id of ids) {
      const o = await env.ESTOQUE_DB.get(keyOrder(id), "json");
      if (o) orders.push(o);
    }
    return json({ ok:true, orders });
  }

  if (url.pathname === "/api/orders" && method === "POST") {
    const body = await request.json().catch(()=>({}));
    if (!body?.cliente || !Array.isArray(body?.itens)) return json({ ok:false, error:"payload inválido" }, 400);
    const id = body.id || String(Date.now());
    const pedido = {
      id,
      referencia: body.referencia || orderRef(body.cliente),
      cliente: body.cliente,
      data: new Date().toISOString(),
      status: body.status || "Novo",
      itens: body.itens.map(i => ({
        productId: Number(i.productId),
        quantidadePedida: Number(i.quantidadePedida||0),
        quantidadeSeparada: Number(i.quantidadeSeparada||0)
      }))
    };
    await env.ESTOQUE_DB.put(keyOrder(id), JSON.stringify(pedido));
    const ids = await listIds(env);
    if (!ids.includes(id)) {
      ids.unshift(id);
      await saveIds(env, ids.slice(0, 500));
    }
    await addHistory(env, "PEDIDO", `Pedido ${pedido.referencia} (${id}) salvo para ${pedido.cliente}`);
    return json({ ok:true, pedido });
  }

  const mGet = url.pathname.match(/^\/api\/orders\/(\d+)$/);
  if (mGet && method === "GET") {
    const id = mGet[1];
    const pedido = await env.ESTOQUE_DB.get(keyOrder(id), "json");
    if (!pedido) return json({ ok:false, error:"not found" }, 404);
    return json({ ok:true, pedido });
  }

  const mStatus = url.pathname.match(/^\/api\/orders\/(\d+)\/status$/);
  if (mStatus && method === "PATCH") {
    const id = mStatus[1];
    const pedido = await env.ESTOQUE_DB.get(keyOrder(id), "json");
    if (!pedido) return json({ ok:false, error:"not found" }, 404);
    const body = await request.json().catch(()=>({}));
    pedido.status = String(body.status||pedido.status);
    await env.ESTOQUE_DB.put(keyOrder(id), JSON.stringify(pedido));
    await addHistory(env, "PEDIDO_STATUS", `Pedido ${pedido.referencia} -> ${pedido.status}`);
    return json({ ok:true });
  }

  const mConf = url.pathname.match(/^\/api\/orders\/(\d+)\/confirmar$/);
  if (mConf && method === "POST") {
    const id = mConf[1];
    const pedido = await env.ESTOQUE_DB.get(keyOrder(id), "json");
    if (!pedido) return json({ ok:false, error:"not found" }, 404);
    const tasks = await request.json().catch(()=>[]);
    // Aplicar baixas no KV inventory
    for (const t of tasks) {
      const pid = Number(t.productId);
      for (const loc of (t.locations||[])) {
        const key = `inv:${String(loc.locationId).toUpperCase()}:${pid}`;
        const item = await env.ESTOQUE_DB.get(key, "json");
        const qty = Number(loc.qty||0);
        if (!item || (item.quantity||0) < qty) {
          return json({ ok:false, error:`quantidade insuficiente em ${loc.locationId} para produto #${pid}` }, 400);
        }
        if (qty === item.quantity) {
          await env.ESTOQUE_DB.delete(key);
        } else {
          item.quantity = item.quantity - qty;
          item.lastAccess = new Date().toISOString();
          await env.ESTOQUE_DB.put(key, JSON.stringify(item));
        }
        await addHistory(env, "SAÍDA", `-${qty} do produto #${pid} de ${loc.locationId} (pedido ${id})`);
      }
    }
    // Atualiza progresso do pedido
    const sepByPid = {};
    for (const t of tasks) {
      const pid = Number(t.productId);
      sepByPid[pid] = (sepByPid[pid]||0) + (t.locations||[]).reduce((a,b)=>a+Number(b.qty||0),0);
    }
    for (const it of pedido.itens) {
      if (sepByPid[it.productId]) {
        it.quantidadeSeparada = Math.min(it.quantidadePedida, (it.quantidadeSeparada||0) + sepByPid[it.productId]);
      }
    }
    const allOk = pedido.itens.every(i => i.quantidadeSeparada >= i.quantidadePedida);
    pedido.status = allOk ? "Concluído" : "Em Separação";
    await env.ESTOQUE_DB.put(keyOrder(id), JSON.stringify(pedido));
    return json({ ok:true, pedido });
  }

  return json({ ok:false, error:"Not found" }, 404);
};
