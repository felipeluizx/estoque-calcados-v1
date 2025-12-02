import { ensureAdminAuth } from "../../lib/admin.js";

const SLOT_PRIORITY = ["FRENTE", "FUNDO"];

const parseLocationId = (locationId) => {
  if (!locationId || typeof locationId !== "string") return null;
  const match = locationId.trim().match(/^([A-Z]+)(\d+)-([A-ZÇÃ]+)$/i);
  if (!match) return null;
  const [, letter, section, slot] = match;
  return {
    letter: letter.toUpperCase(),
    section: Number(section),
    slot: slot.toUpperCase(),
  };
};

const compareLocations = (a, b) => {
  if (a === b) return 0;
  const parsedA = parseLocationId(a);
  const parsedB = parseLocationId(b);
  if (!parsedA || !parsedB || !Number.isFinite(parsedA.section) || !Number.isFinite(parsedB.section)) {
    return String(a || "").localeCompare(String(b || ""));
  }

  if (parsedA.section !== parsedB.section) return parsedA.section - parsedB.section;

  const letterCompare = parsedA.letter.localeCompare(parsedB.letter);
  if (letterCompare !== 0) return letterCompare;

  const priorityA = SLOT_PRIORITY.indexOf(parsedA.slot);
  const priorityB = SLOT_PRIORITY.indexOf(parsedB.slot);
  if (priorityA !== priorityB && priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;

  if (priorityA === -1 && priorityB !== -1) return 1;
  if (priorityB === -1 && priorityA !== -1) return -1;

  return String(a || "").localeCompare(String(b || ""));
};

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
        return compareLocations(a.locationId, b.locationId);
      });

      const target = sortedByQty.reduce((best, row) => {
        if (!best) return row;
        const compare = compareLocations(row.locationId, best.locationId);
        return isHot ? (compare < 0 ? row : best) : compare > 0 ? row : best;
      }, null);

      const donors = sortedByQty
        .filter((row) => row.locationId !== target.locationId)
        .sort((a, b) => {
          const qtyDiff = Number(a.quantity || 0) - Number(b.quantity || 0);
          if (qtyDiff !== 0) return qtyDiff;
          return compareLocations(a.locationId, b.locationId);
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
