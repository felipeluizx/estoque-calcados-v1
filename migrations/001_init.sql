-- inventory: cada linha = (locationId, productId) com quantidade
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  locationId TEXT NOT NULL,
  productId INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(locationId);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(productId);

-- history: log de movimentações
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT NOT NULL
);
