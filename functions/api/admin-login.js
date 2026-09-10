const SESSION_TTL_SECONDS = 60 * 60 * 24;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });

function toBase64Url(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signToken(secret, payload) {
  const enc = new TextEncoder();
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${toBase64Url(sig)}`;
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const adminPassword = env?.ADMIN_PASSWORD;
    const adminUsername = env?.ADMIN_USERNAME || env?.ADMIN_USER || "";

    if (!adminPassword) return json({ ok: false, error: "ADMIN_PASSWORD não configurado no Preview." }, 500);

    let body = {};
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "JSON inválido." }, 400); }

    const providedPassword = String(body?.password || "");
    const providedUser = String(body?.username || "").trim();

    if (!providedPassword) return json({ ok: false, error: "Senha obrigatória." }, 400);
    if (adminUsername && !providedUser) return json({ ok: false, error: "Usuário obrigatório." }, 400);
    if (adminUsername && providedUser !== adminUsername) return json({ ok: false, error: "Usuário ou senha incorretos." }, 401);
    if (providedPassword !== adminPassword) return json({ ok: false, error: "Usuário ou senha incorretos." }, 401);

    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(adminPassword, {
      sub: providedUser || "admin",
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
      v: 3,
    });

    return json({ ok: true, token, expiresIn: SESSION_TTL_SECONDS });
  } catch (err) {
    console.error("[admin-login]", err);
    return json({ ok: false, error: `Falha ao autenticar: ${err?.message || "erro desconhecido"}` }, 500);
  }
};
