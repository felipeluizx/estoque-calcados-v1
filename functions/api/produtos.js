// functions/api/produtos.js

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });

function assertKV(env) {
  const kv = env?.ESTOQUE_DB;
  if (!kv) {
    throw new Error("Binding KV 'ESTOQUE_DB' não encontrado.");
  }
  return kv;
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
