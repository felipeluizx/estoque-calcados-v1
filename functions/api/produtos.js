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

// Handler para buscar a lista de produtos
export const onRequestGet = async ({ env }) => {
  try {
    const kv = assertKV(env);
    const productListJson = await kv.get("products");
    const productList = productListJson ? JSON.parse(productListJson) : [];
    return json(productList);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

// Handler para salvar a lista de produtos
export const onRequestPost = async ({ request, env }) => {
  try {
    const kv = assertKV(env);
    const authorized = await hasValidAdminSession(request, kv);
    if (!authorized) {
      return json({ ok: false, error: "Token administrativo inválido ou ausente." }, 401);
    }
    const productList = await request.json();

    if (!Array.isArray(productList)) {
      return json({ error: "O corpo da requisição deve ser um array de produtos." }, 400);
    }

    await kv.put("products", JSON.stringify(productList));
    return json({ ok: true, message: "Lista de produtos salva com sucesso." });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
