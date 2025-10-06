
export const onRequest = async ({ env, request, params }) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const send = (b, s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8'}});
  const KV = env.KV;

  async function loadArray(key){
    const s = await KV.get(key); if(!s) return [];
    try{ return JSON.parse(s); }catch{ return []; }
  }
  async function saveArray(key, arr){
    await KV.put(key, JSON.stringify(arr));
  }
  async function appendHistory(line){
    const arr = await loadArray('history');
    const entry = typeof line==='string' ? { date: new Date().toISOString(), type:'INFO', details: line } : line;
    arr.unshift(entry);
    await saveArray('history', arr);
  }
  function parseSlot(loc){ return String(loc||'').split('-')[1]||''; }
  function slotRank(loc){
    const s = parseSlot(loc).toUpperCase();
    if (s==='FRENTE') return 0;
    if (s==='MEIO')   return 1;
    return 2;
  }
  function normalize(s){ return String(s||'').normalize('NFD').replace(/\p{Diacritic}+/gu,'').toUpperCase().trim(); }

  if (url.pathname === '/api/orders' && method==='POST') {
    const body = await request.json().catch(()=>({}));
    const products = await loadArray('products');

    const resolved = [];
    for (const row of (body.items||[])) {
      const req = Number(row.requested||row.qty||row.qtd||0);
      if (!row || !req) continue;
      if (row.productId || row.id) {
        resolved.push({ productId: Number(row.productId||row.id), requested: req, allocated:0, picked:0 });
        continue;
      }
      const q = normalize(row.query||row.nome||'');
      let best = null, bestScore = -1;
      for (const p of products) {
        const parts = [p.modelo, p.material, p.variacao, p.grade].map(normalize).filter(Boolean);
        const text  = parts.join(' ');
        let score = 0;
        for (const tok of q.split(/\s+/)) if (tok && text.includes(tok)) score++;
        if (score > bestScore) { bestScore = score; best = p; }
      }
      if (best) resolved.push({ productId: Number(best.id), requested: req, allocated:0, picked:0, matched: best });
    }

    const ver = Number(await KV.get('version')||0)+1; await KV.put('version', String(ver));
    const orderId = ver;

    const order = { id: orderId, createdAt: new Date().toISOString(), status:'draft', customer: body.customer||null, notes: body.notes||null };
    await KV.put(`order:${orderId}`, JSON.stringify(order));
    await KV.put(`order:${orderId}:items`, JSON.stringify(resolved));

    return send({ ok:true, order, items: resolved });
  }

  const m = url.pathname.match(/^\/api\/orders\/(\d+)\/(allocate|start|picklist|scan|finish)$/);
  if (m) {
    const orderId = Number(m[1]); const action = m[2];
    const order = JSON.parse(await KV.get(`order:${orderId}`)||'null');
    const items = JSON.parse(await KV.get(`order:${orderId}:items`)||'[]');
    if (!order) return send({ ok:false, error:'order not found' },404);

    if (action==='allocate' && method==='POST') {
      const inventory = await loadArray('inventory');
      for (const it of items) {
        let need = it.requested - (it.allocated||0);
        if (need<=0) continue;
        const slots = ['FRENTE','MEIO','FUNDO'];
        for (const slot of slots) {
          if (need<=0) break;
          const candidates = inventory.filter(r => r.productId===it.productId && parseSlot(r.locationId).toUpperCase()===slot && r.quantity>0);
          for (const r of candidates) {
            if (need<=0) break;
            const take = Math.min(need, r.quantity);
            it.allocated = (it.allocated||0) + take;
            need -= take;
          }
        }
      }
      order.status = 'allocated';
      await KV.put(`order:${orderId}`, JSON.stringify(order));
      await KV.put(`order:${orderId}:items`, JSON.stringify(items));
      return send({ ok:true, order, items });
    }

    if (action==='picklist' && method==='GET') {
      const inventory = await loadArray('inventory');
      const products  = await loadArray('products');
      const steps = [];
      const missing = [];
      for (const it of items) {
        let need = it.requested;
        const bySlot = inventory.filter(r => r.productId===it.productId && r.quantity>0)
                                .sort((a,b)=>slotRank(a.locationId)-slotRank(b.locationId));
        for (const r of bySlot) {
          if (need<=0) break;
          const take = Math.min(need, r.quantity);
          steps.push({ productId: it.productId, locationId: r.locationId, qty: take });
          need -= take;
        }
        if (need>0) missing.push({ productId: it.productId, missing: need });
      }
      const name = pid => {
        const p = products.find(x=>Number(x.id)===Number(pid));
        return p ? `${p.modelo} ${p.material} ${p.variacao} ${p.grade}` : `#${pid}`;
      };
      steps.forEach(s => s.name = name(s.productId));
      missing.forEach(m => m.name = name(m.productId));
      steps.sort((a,b)=>slotRank(a.locationId)-slotRank(b.locationId));
      return send({ ok:true, steps, missing });
    }

    if (action==='start' && method==='POST') {
      order.status='picking'; await KV.put(`order:${orderId}`, JSON.stringify(order));
      return send({ ok:true });
    }

    if (action==='scan' && method==='POST') {
      const body = await request.json().catch(()=>({}));
      const mode = body.mode || 'finish';
      const pid  = Number(body.productId||0);
      const qty  = Number(body.qty||1);
      const loc  = body.locationId ? String(body.locationId) : null;

      const items2 = JSON.parse(await KV.get(`order:${orderId}:items`)||'[]');
      const it = items2.find(x=>x.productId===pid);
      if (!it) return send({ ok:false, error:'produto não está no pedido' },400);
      it.picked = (it.picked||0) + qty;
      await KV.put(`order:${orderId}:items`, JSON.stringify(items2));

      if (mode==='immediate' && loc) {
        const inv = await loadArray('inventory');
        const row = inv.find(r => r.productId===pid && r.locationId===loc);
        if (!row || row.quantity<qty) return send({ ok:false, error:'estoque insuficiente' },409);
        row.quantity -= qty;
        await saveArray('inventory', inv);
        await appendHistory({ date:new Date().toISOString(), type:'SAÍDA', details: `- ${qty} cx de #${pid} de ${loc} (scan pedido ${orderId})` });
      }
      return send({ ok:true });
    }

    if (action==='finish' && method==='POST') {
      const inv  = await loadArray('inventory');
      const items2 = JSON.parse(await KV.get(`order:${orderId}:items`)||'[]');
      for (const it of items2) {
        let need = Math.max(0, (it.picked||0));
        if (need<=0) continue;
        const locs = inv.filter(r => r.productId===it.productId && r.quantity>0)
                        .sort((a,b)=>slotRank(a.locationId)-slotRank(b.locationId));
        for (const r of locs) {
          if (need<=0) break;
          const take = Math.min(need, r.quantity);
          r.quantity -= take;
          need -= take;
          await appendHistory({ date:new Date().toISOString(), type:'SAÍDA', details: `- ${take} cx de #${it.productId} de ${r.locationId} (pedido ${orderId})` });
        }
      }
      await saveArray('inventory', inv);
      const order2 = JSON.parse(await KV.get(`order:${orderId}`)||'null');
      if (order2){ order2.status='complete'; await KV.put(`order:${orderId}`, JSON.stringify(order2)); }
      return send({ ok:true });
    }

    return send({ ok:false, error:'Unsupported method' },405);
  }

  return send({ ok:false, error:'Not found' },404);
};
