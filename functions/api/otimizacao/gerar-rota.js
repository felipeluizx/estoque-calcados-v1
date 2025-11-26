import { ensureAdminAuth } from "../../lib/admin.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestPost({ request, env }) {
  try {
    const { response } = await ensureAdminAuth(request, env);
    if (response) return response;

    const payload = await request.json().catch(() => null);
    const maxMoves = Number(payload?.maxMoves);
    const threshold = Number(payload?.threshold);

    if (!Number.isFinite(maxMoves) || maxMoves <= 0 || !Number.isFinite(threshold) || threshold <= 0) {
      return json({ error: "maxMoves e threshold devem ser números positivos" }, 400);
    }

    const inventoryRows = await env.DB.prepare(
      "SELECT id, locationId, productId, quantity FROM inventory WHERE quantity > 0"
    ).all();

    const inventory = inventoryRows?.results || [];
    if (inventory.length === 0) {
      return json({ error: "nenhum item em estoque para otimizar" }, 400);
    }

    const byProduct = new Map();
    for (const row of inventory) {
      const list = byProduct.get(row.productId) || [];
      list.push(row);
      byProduct.set(row.productId, list);
    }

    const steps = [];
    let totalUnitsMoved = 0;

    for (const [productId, rows] of byProduct.entries()) {
      if (steps.length >= maxMoves) break;
      if (!rows || rows.length <= 1) continue;

      const totalQty = rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      const isHot = totalQty >= threshold;

      const sortedByQty = [...rows].sort((a, b) => {
        const qtyDiff = Number(b.quantity || 0) - Number(a.quantity || 0);
        if (qtyDiff !== 0) return qtyDiff;
        return String(a.locationId).localeCompare(String(b.locationId));
      });

      const target = sortedByQty.reduce((best, row) => {
        if (!best) return row;
        const compare = String(row.locationId).localeCompare(String(best.locationId));
        return isHot ? (compare < 0 ? row : best) : compare > 0 ? row : best;
      }, null);

      const donors = sortedByQty
        .filter((row) => row.locationId !== target.locationId)
        .sort((a, b) => {
          const qtyDiff = Number(a.quantity || 0) - Number(b.quantity || 0);
          if (qtyDiff !== 0) return qtyDiff;
          return String(a.locationId).localeCompare(String(b.locationId));
        });

      for (const source of donors) {
        if (steps.length >= maxMoves) break;
        const qty = Number(source.quantity || 0);
        if (qty <= 0) continue;

        steps.push({
          productId,
          from: source.locationId,
          to: target.locationId,
          quantity: qty,
          temperature: isHot ? "hot" : "cold",
        });
        totalUnitsMoved += qty;
      }
    }

    if (steps.length === 0) {
      return json({ error: "nenhuma movimentação sugerida dentro dos parâmetros" }, 400);
    }

    const routeId = crypto.randomUUID();
    const totals = {
      totalSteps: steps.length,
      hotSteps: steps.filter((s) => s.temperature === "hot").length,
      coldSteps: steps.filter((s) => s.temperature === "cold").length,
      totalUnits: totalUnitsMoved,
    };

    return json({ routeId, steps, totals });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
