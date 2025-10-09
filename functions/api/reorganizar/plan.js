// functions/api/reorganizar/plan.js  (KV-only)
import { json, listInventory, parseCol, parseSlot, slotRank } from "../../_kv";

export const onRequestPost = async ({ env, request }) => {
  const body = await request.json().catch(()=>({}));
  const maxMoves = Number(body.maxMoves || 200);
  const zebraThreshold = Number(body.zebraThreshold || 0.5);

  const inv = await listInventory(env);
  const byCol = {};
  let occupiedCount = 0;
  for (const row of inv) {
    if ((row.quantity||0)>0) occupiedCount++;
    const col = parseCol(row.locationId);
    byCol[col] = byCol[col] || [];
    byCol[col].push(row);
  }
  const total = inv.length || 1;
  const occupancy = occupiedCount / total;

  const suggestions = [];

  // 1) Consolidação vertical
  for (const col of Object.keys(byCol).sort()) {
    const rows = byCol[col].slice().sort((a,b)=>slotRank(a.locationId)-slotRank(b.locationId));
    const has = { FRENTE:null, MEIO:null, FUNDO:null };
    for (const r of rows) has[parseSlot(r.locationId)] = r;

    if (!has["MEIO"] && has["FRENTE"] && has["FRENTE"].quantity>0) {
      suggestions.push({ rule:"CONSOLIDACAO_VERTICAL", productId:has["FRENTE"].productId, from:has["FRENTE"].locationId, to:`${col}-MEIO`, qty:has["FRENTE"].quantity });
    }
    if (!has["FUNDO"] && has["MEIO"] && has["MEIO"].quantity>0) {
      suggestions.push({ rule:"CONSOLIDACAO_VERTICAL", productId:has["MEIO"].productId, from:has["MEIO"].locationId, to:`${col}-FUNDO`, qty:has["MEIO"].quantity });
    }
  }

  // 2) Zebra
  if (occupancy < zebraThreshold) {
    const cols = Object.keys(byCol).sort();
    const oddCols = cols.filter(c => ((c.charCodeAt(0) - "A".charCodeAt(0)) % 2) === 0);
    const evenCols = cols.filter(c => !oddCols.includes(c));
    for (const col of evenCols) {
      for (const row of byCol[col]) {
        const targetCol = oddCols[0];
        if (!targetCol) continue;
        const target = `${targetCol}-${parseSlot(row.locationId)}`;
        if (target !== row.locationId) {
          suggestions.push({ rule:"ZEBRA", productId:row.productId, from:row.locationId, to:target, qty:row.quantity });
        }
      }
    }
  }

  // 3) Popularidade
  for (const col of Object.keys(byCol)) {
    const rows = byCol[col].slice().sort((a,b)=> new Date(b.lastAccess||0) - new Date(a.lastAccess||0));
    const desired = ["FRENTE","MEIO","FUNDO"];
    for (let i=0;i<Math.min(3, rows.length);i++){
      const r = rows[i];
      const want = `${col}-${desired[i]}`;
      if (r.locationId !== want) {
        suggestions.push({ rule:"POPULARIDADE", productId:r.productId, from:r.locationId, to:want, qty:r.quantity });
      }
    }
  }

  return json({ ok:true, occupancy, moves: suggestions.slice(0, maxMoves) });
};
