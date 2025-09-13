async function addHistory(env, type, details) {
  await env.DB.prepare(
    "INSERT INTO history(date, type, details) VALUES (?, ?, ?)"
  ).bind(new Date().toISOString(), type, details).run();
}

export async function onRequestPost({ env }) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM inventory"),
    env.DB.prepare("DELETE FROM history")
  ]);
  await addHistory(env, "RESET", "O estoque foi completamente zerado.");
  return Response.json({ ok: true });
}
