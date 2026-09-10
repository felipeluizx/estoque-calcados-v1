PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_prices (
  product_id INTEGER PRIMARY KEY,
  base_price REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE order_items ADD COLUMN base_unit_price REAL;
ALTER TABLE order_items ADD COLUMN discount_percent REAL;
