-- Listas de separação (agrupam produtos a serem separados)
CREATE TABLE IF NOT EXISTS separation_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'in_progress', 'done', 'canceled')),
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'planned')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Itens incluídos em uma lista de separação
CREATE TABLE IF NOT EXISTS separation_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL REFERENCES separation_lists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  requested_qty INTEGER NOT NULL,
  separated_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'separating', 'done', 'canceled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sep_list_items_list ON separation_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_sep_list_items_product ON separation_list_items(product_id);

-- Rotas que organizam a separação por ordem/colaborador
CREATE TABLE IF NOT EXISTS separation_routes (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES separation_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done', 'canceled')),
  kind TEXT NOT NULL CHECK (kind IN ('picking', 'transfer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sep_routes_list ON separation_routes(list_id);

-- Passos de cada rota de separação (em sequência)
CREATE TABLE IF NOT EXISTS separation_route_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL REFERENCES separation_routes(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'skipped')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sep_steps_route ON separation_route_steps(route_id);
CREATE INDEX IF NOT EXISTS idx_sep_steps_product ON separation_route_steps(product_id);
CREATE INDEX IF NOT EXISTS idx_sep_steps_order ON separation_route_steps(step_order);
