import { requireAdmin, unauthorized } from "../lib/admin-auth.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const { results } = await env.DB.prepare(`SELECT id, name, phone, notes, created_at, updated_at FROM customers ORDER BY name COLLATE NOCASE`).all();
    return json({ ok: true, customers: results || [] });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    if (!name) return json({ ok: false, error: "Nome do cliente é obrigatório." }, 400);

    const result = await env.DB.prepare(`INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?) RETURNING id, name, phone, notes, created_at, updated_at`)
      .bind(name, phone, notes).first();
    return json({ ok: true, customer: result }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
