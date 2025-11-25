export async function loadList(env, id) {
  const list = await env.DB.prepare(
    "SELECT id, name, status, kind, created_at, updated_at FROM separation_lists WHERE id=?"
  )
    .bind(id)
    .first();

  if (!list) return null;

  const items = await env.DB.prepare(
    "SELECT id, list_id, product_id, requested_qty, separated_qty, status, created_at FROM separation_list_items WHERE list_id=? ORDER BY id"
  )
    .bind(id)
    .all();

  const routes = await env.DB.prepare(
    "SELECT id, list_id, name, status, kind, created_at, updated_at FROM separation_routes WHERE list_id=? ORDER BY created_at"
  )
    .bind(id)
    .all();

  const routeResults = routes?.results || [];
  const enrichedRoutes = [];
  for (const route of routeResults) {
    const steps = await env.DB.prepare(
      "SELECT id, route_id, product_id, step_order, quantity, status, action, from_location, to_location FROM separation_route_steps WHERE route_id=? ORDER BY step_order"
    )
      .bind(route.id)
      .all();

    enrichedRoutes.push({ ...route, steps: steps?.results || [] });
  }

  return {
    ...list,
    items: items?.results || [],
    routes: enrichedRoutes,
  };
}

export async function loadRoute(env, routeId) {
  const route = await env.DB.prepare(
    "SELECT id, list_id, name, status, kind, created_at, updated_at FROM separation_routes WHERE id=?"
  )
    .bind(routeId)
    .first();

  if (!route) return null;

  const steps = await env.DB.prepare(
    "SELECT id, route_id, product_id, step_order, quantity, status, action, from_location, to_location FROM separation_route_steps WHERE route_id=? ORDER BY step_order"
  )
    .bind(route.id)
    .all();

  return { ...route, steps: steps?.results || [] };
}

export async function loadLists(env) {
  const lists = await env.DB.prepare(
    "SELECT id, name, status, kind, created_at, updated_at FROM separation_lists ORDER BY created_at DESC"
  ).all();

  const listResults = lists?.results || [];
  const enriched = [];
  for (const list of listResults) {
    const items = await env.DB.prepare(
      "SELECT id, list_id, product_id, requested_qty, separated_qty, status, created_at FROM separation_list_items WHERE list_id=? ORDER BY id"
    )
      .bind(list.id)
      .all();

    enriched.push({ ...list, items: items?.results || [] });
  }

  return enriched;
}
