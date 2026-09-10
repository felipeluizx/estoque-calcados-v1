import { requireAdmin, unauthorized } from "../lib/admin-auth.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });

function assertKV(env) {
  const kv = env?.KV_BINDING || env?.ESTOQUE_DB;
  if (!kv) throw new Error("Binding KV 'KV_BINDING'/'ESTOQUE_DB' não encontrado.");
  return kv;
}

const isValidPayload = (payload) => {
  if (Array.isArray(payload)) return true;
  if (!payload || typeof payload !== "object") return false;
  return Array.isArray(payload.products) && Array.isArray(payload.labelTemplates);
};

const normalizePayload = (payload) => {
  if (Array.isArray(payload)) return { products: payload, labelTemplates: [] };
  if (payload && typeof payload === "object") {
    return {
      products: Array.isArray(payload.products) ? payload.products : [],
      labelTemplates: Array.isArray(payload.labelTemplates) ? payload.labelTemplates : [],
    };
  }
  return { products: [], labelTemplates: [] };
};

export const onRequestGet = async ({ env }) => {
  try {
    const kv = assertKV(env);
    const productListJson = await kv.get("products");
    const payload = productListJson ? JSON.parse(productListJson) : [];
    return json(normalizePayload(payload));
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

export const onRequestPost = async ({ request, env }) => {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const kv = assertKV(env);
    const payload = await request.json();
    if (!isValidPayload(payload)) {
      return json({ ok: false, error: "Payload inválido. Envie produtos/labelTemplates em formato de array." }, 400);
    }
    const normalized = normalizePayload(payload);
    await kv.put("products", JSON.stringify(normalized));
    return json({ ok: true, message: "Lista de produtos/templates salva com sucesso." });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
};
