PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  pc TEXT,
  order_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date TEXT,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  manually_closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity_ordered INTEGER NOT NULL CHECK(quantity_ordered > 0),
  quantity_cancelled INTEGER NOT NULL DEFAULT 0 CHECK(quantity_cancelled >= 0),
  unit_price REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS production_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_item ON production_movements(order_item_id);
CREATE INDEX IF NOT EXISTS idx_production_date ON production_movements(created_at);

CREATE TABLE IF NOT EXISTS receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  order_id INTEGER,
  description TEXT,
  amount REAL NOT NULL CHECK(amount >= 0),
  due_date TEXT,
  adjustment REAL NOT NULL DEFAULT 0,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_receivables_customer ON receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_order ON receivables(order_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receivable_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_receivable ON payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
