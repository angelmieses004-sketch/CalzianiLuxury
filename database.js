const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In production (Railway) use /data volume; locally use project root
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'calziani.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL CHECK(price >= 0),
    category TEXT NOT NULL CHECK(category IN ('calzado', 'ropa', 'accesorio')),
    stock INTEGER DEFAULT 0 CHECK(stock >= 0),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    google_id TEXT UNIQUE,
    avatar TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id),
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    itbis REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    cardnet_session TEXT,
    cardnet_session_key TEXT,
    customer_name TEXT,
    customer_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations
try { db.exec(`ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN tracking_code TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN tracking_stage TEXT DEFAULT 'received'`); } catch (_) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN tracking_notes TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code) WHERE tracking_code IS NOT NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT '[]'`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN shipping_days TEXT DEFAULT NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN compare_price REAL DEFAULT NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN image TEXT DEFAULT NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN sizes_stock TEXT DEFAULT '{}'`); } catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN gender TEXT DEFAULT NULL`); } catch (_) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);
} catch (_) {}
try { db.exec(`ALTER TABLE products ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE brands ADD COLUMN promo_min_price_usd REAL`); } catch (_) {}
try { db.exec(`ALTER TABLE brands ADD COLUMN promo_excluded INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
// Valores iniciales sugeridos (solo si aún no están configurados)
try {
  db.prepare(`UPDATE brands SET promo_min_price_usd = 350 WHERE LOWER(name) LIKE '%golden%' AND promo_min_price_usd IS NULL AND promo_excluded = 0`).run();
  db.prepare(`UPDATE brands SET promo_excluded = 1 WHERE LOWER(name) LIKE '%philippe%' AND promo_excluded = 0`).run();
} catch (_) {}

// Migrate old single `image` column into product_images table (run once)
const productsWithLegacyImage = db.prepare(
  `SELECT id, image FROM products WHERE image IS NOT NULL AND image != ''`
).all();
const insertImg = db.prepare(
  `INSERT OR IGNORE INTO product_images (product_id, filename, position) VALUES (?, ?, 0)`
);
const migrateMany = db.transaction(() => {
  for (const p of productsWithLegacyImage) {
    const exists = db.prepare(
      `SELECT id FROM product_images WHERE product_id = ? AND filename = ?`
    ).get(p.id, p.image);
    if (!exists) insertImg.run(p.id, p.image);
  }
});
migrateMany();

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      promo_code TEXT NOT NULL,
      phone_key TEXT NOT NULL,
      order_number TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (promo_code, phone_key)
    );
  `);
} catch (_) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code                 TEXT PRIMARY KEY,
      percent              INTEGER NOT NULL,
      active               INTEGER NOT NULL DEFAULT 1,
      expires_at           TEXT,
      excluded_product_ids TEXT NOT NULL DEFAULT '[]',
      created_at           TEXT DEFAULT (datetime('now'))
    );
  `);
  // Seed legacy hard-coded codes (INSERT OR IGNORE so re-runs are safe)
  const seedPromo = db.prepare(
    `INSERT OR IGNORE INTO promo_codes (code, percent, active, expires_at) VALUES (?, ?, ?, ?)`
  );
  seedPromo.run('CALZIANI',  20, 0, '2026-05-10T00:00:00Z');
  seedPromo.run('EXCLUSIVE', 25, 1, null);
} catch (_) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      caption TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (_) {}

try { db.exec(`ALTER TABLE customer_photos ADD COLUMN rating INTEGER`); } catch (_) {}
try { db.exec(`ALTER TABLE customer_photos ADD COLUMN review_text TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE customer_photos ADD COLUMN reviewer_name TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE customer_photos ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch (_) {}

const existingAdmin = db.prepare('SELECT id FROM admin WHERE id = 1').get();
if (!existingAdmin) {
  db.prepare("INSERT INTO admin (id, username, password) VALUES (1, 'admin', 'calziani2024')").run();
}

module.exports = db;
