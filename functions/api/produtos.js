// functions/api/produtos.js

const SESSION_PREFIX = "admin-session:";

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
  if (!kv) {
    throw new Error("Binding KV 'KV_BINDING'/'ESTOQUE_DB' não encontrado.");
  }
  return kv;
}

async function hasValidAdminSession(request, kv) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  const session = await kv.get(`${SESSION_PREFIX}${token}`);
  return Boolean(session);
}

const normalizePayload = (payload) => {
  if (Array.isArray(payload)) {
    return { products: payload, labelTemplates: [] };
  }
  if (payload && typeof payload === "object") {
    const products = Array.isArray(payload.products) ? payload.products : [];
    const labelTemplates = Array.isArray(payload.labelTemplates)
      ? payload.labelTemplates
      : [];
    return { products, labelTemplates };
  }
  return { products: [], labelTemplates: [] };
};

// Handler para buscar a lista de produtos
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

// Handler para salvar a lista de produtos + templates
export const onRequestPost = async ({ request, env }) => {
  try {
    const kv = assertKV(env);
    const authorized = await hasValidAdminSession(request, kv);
    if (!authorized) {
      return json({ ok: false, error: "Token administrativo inválido ou ausente." }, 401);
    }
    const payload = await request.json();
    const normalized = normalizePayload(payload);

    await kv.put("products", JSON.stringify(normalized));
    return json({ ok: true, message: "Lista de produtos/templates salva com sucesso." });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
