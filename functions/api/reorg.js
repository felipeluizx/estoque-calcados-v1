
export const onRequest = async ({ env, request }) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const send = (b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8'}});
  const KV = ESTOQUE_DB;

  async function loadArray(key){ const s=await KV.get(key); if(!s) return []; try{return JSON.parse(s);}catch{return [];} }
  async function saveArray(key, arr){ await KV.put(key, JSON.stringify(arr)); }
  function parseSlot(loc){ return String(loc||'').split('-')[1]||''; }
  function slotRank(loc){ const s=parseSlot(loc).toUpperCase(); if(s==='FRENTE') return 0; if(s==='MEIO') return 1; return 2; }

  if (url.pathname === '/api/reorg/plan' && method==='POST') {
    const body = await request.json().catch(()=>({}));
    const maxMoves = Number(body.maxMoves||200);
    const inv = await loadArray('inventory');

    const positions = Array.from(new Set(inv.map(r=>r.locationId))).sort((a,b)=>slotRank(a)-slotRank(b));

    const totals = {};
    for (const r of inv) totals[r.productId]=(totals[r.productId]||0)+r.quantity;
    const skuList = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(e=>Number(e[0]));

    const ideal = {}; let pi=0;
    for (const sku of skuList) {
      let need = totals[sku];
      while (need>0 && pi<positions.length) {
        const loc = positions[pi++];
        const put = need; ideal[loc] = { productId: sku, qty: (ideal[loc]?.qty||0)+put };
        need -= put;
      }
    }

    const curr = {};
    for (const r of inv) {
      curr[r.locationId] = curr[r.locationId]||[];
      curr[r.locationId].push({ productId:r.productId, qty:r.quantity });
    }

    const moves = [];
    let left = maxMoves;
    for (const loc of positions) {
      if (left<=0) break;
      const want = ideal[loc]; if(!want) continue;
      const have = (curr[loc]||[]).reduce((a,b)=>{a[b.productId]=(a[b.productId]||0)+b.qty; return a;},{});
      let need = Math.max(0, (want.qty||0) - (have[want.productId]||0));
      if (need<=0) continue;

      const sources = inv.filter(r=>r.productId===want.productId).sort((a,b)=>slotRank(b.locationId)-slotRank(a.locationId));
      for (const s of sources) {
        if (left<=0 || need<=0) break;
        if (s.locationId===loc) continue;
        const take = Math.min(need, s.quantity);
        if (take<=0) continue;
        const id = Number(await KV.get('seq:move')||0)+1; await KV.put('seq:move', String(id));
        moves.push({ id, productId: want.productId, from: s.locationId, to: loc, qty: take });
        need -= take; left--;
      }
    }

    const planId = Number(await KV.get('seq:reorg')||0)+1; await KV.put('seq:reorg', String(planId));
    const plan = { id: planId, createdAt: new Date().toISOString(), status:'draft', strategy:'slot', moves };
    await KV.put(`reorg:plan:${planId}`, JSON.stringify(plan));

    return send({ ok:true, plan });
  }

  if (url.pathname === '/api/reorg/scan' && method==='POST') {
    const body = await request.json().catch(()=>({}));
    const inv = await loadArray('inventory');

    const move = body.move || body; // { productId, from, to, qty, moveId }
    const rowFrom = inv.find(r=>r.productId===move.productId && r.locationId===move.from);
    if (!rowFrom || rowFrom.quantity < move.qty) return send({ ok:false, error:'estoque insuficiente na origem' },409);
    rowFrom.quantity -= move.qty;
    let rowTo = inv.find(r=>r.productId===move.productId && r.locationId===move.to);
    if (!rowTo) { rowTo = { productId: move.productId, locationId: move.to, quantity:0 }; inv.push(rowTo); }
    rowTo.quantity += move.qty;

    for (let i=inv.length-1;i>=0;i--) if (inv[i].quantity<=0) inv.splice(i,1);
    await saveArray('inventory', inv);

    const hist = await loadArray('history');
    hist.unshift({ date:new Date().toISOString(), type:'MOVIMENTAÇÃO', details:`${move.qty} cx de #${move.productId} de ${move.from} → ${move.to}` });
    await saveArray('history', hist);

    return send({ ok:true, applied:true });
  }

  return send({ ok:false, error:'Not found' },404);
};
