require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
// express-session is required inside the SqliteStore class definition below
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./database');

// In production use /data/img/products (persistent volume); locally use public/img/products
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(DATA_DIR, 'img', 'products');
const CUSTOMER_PHOTOS_DIR = path.join(DATA_DIR, 'img', 'customer-photos');
if (!require('fs').existsSync(UPLOAD_DIR)) require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CUSTOMER_PHOTOS_DIR)) fs.mkdirSync(CUSTOMER_PHOTOS_DIR, { recursive: true });

// Multer: memory storage, multiple files under field name "images"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP)'));
  },
});

async function processAndSaveImage(buffer) {
  const filename = `p_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toFile(path.join(UPLOAD_DIR, filename));
  return filename;
}

function deleteImageFile(filename) {
  if (filename) fs.unlink(path.join(UPLOAD_DIR, filename), () => {});
}

async function processAndSaveCustomerPhoto(buffer) {
  const filename = `c_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
  await sharp(buffer)
    .resize(720, 900, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toFile(path.join(CUSTOMER_PHOTOS_DIR, filename));
  return filename;
}

function deleteCustomerPhotoFile(filename) {
  if (filename) fs.unlink(path.join(CUSTOMER_PHOTOS_DIR, filename), () => {});
}

function metaSha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

async function sendMetaPurchaseEvent({ orderNumber, total, numItems, email, phone, req }) {
  const pixelId = process.env.META_PIXEL_ID || process.env.FACEBOOK_PIXEL_ID;
  const token = process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const userData = {};
  const em = metaSha256(email);
  const ph = phone ? metaSha256(String(phone).replace(/\D/g, '')) : null;
  if (em) userData.em = em;
  if (ph) userData.ph = ph;
  if (req) {
    const fwd = req.headers['x-forwarded-for'];
    userData.client_ip_address = (typeof fwd === 'string' ? fwd.split(',')[0] : '')?.trim()
      || req.socket?.remoteAddress || '';
    userData.client_user_agent = req.headers['user-agent'] || '';
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: String(orderNumber),
          action_source: 'website',
          user_data: userData,
          custom_data: {
            value: Number(total),
            currency: 'USD',
            num_items: Number(numItems) || 1,
            order_id: String(orderNumber),
          },
        }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[Meta CAPI] Purchase failed:', res.status, body.slice(0, 300));
    }
  } catch (e) {
    console.error('[Meta CAPI] Purchase error:', e.message);
  }
}

function getCustomerPhotos(productId, activeOnly = true) {
  const whereActive = activeOnly ? ' AND active = 1' : '';
  return db.prepare(
    `SELECT id, product_id, filename, caption, position, active
     FROM customer_photos
     WHERE product_id = ?${whereActive}
     ORDER BY position ASC, id ASC`
  ).all(productId);
}

function customerPhotoCount(productId) {
  return db.prepare(
    'SELECT COUNT(*) AS n FROM customer_photos WHERE product_id = ? AND active = 1'
  ).get(productId).n;
}

// Fetch ordered images for a product
function getProductImages(productId) {
  return db.prepare(
    'SELECT id, filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC'
  ).all(productId);
}

/** Stock check for checkout (sizes required when product has talles). */
function availabilityForCartLine(productRow, lineSize) {
  let sizes;
  let sizes_stock;
  try { sizes = JSON.parse(productRow.sizes || '[]'); } catch { sizes = []; }
  try { sizes_stock = JSON.parse(productRow.sizes_stock || '{}'); } catch { sizes_stock = {}; }
  const sz = lineSize != null && String(lineSize).trim() !== '' ? String(lineSize).trim() : '';
  if (Array.isArray(sizes) && sizes.length > 0) {
    if (!sz) return { ok: false, code: 'size_required', available: 0, name: productRow.name };
    if (!sizes.includes(sz)) return { ok: false, code: 'bad_size', available: 0, name: productRow.name };
    const v = sizes_stock[sz];
    return { ok: true, available: Math.max(0, Math.floor(Number(v) || 0)), name: productRow.name };
  }
  return { ok: true, available: Math.max(0, Math.floor(Number(productRow.stock) || 0)), name: productRow.name };
}

function validateCartStock(cart) {
  if (!Array.isArray(cart) || !cart.length) return { ok: false, error: 'Carrito vacío.' };
  for (const line of cart) {
    const id = Number(line.id);
    if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Carrito inválido.' };
    const p = db.prepare('SELECT id, name, stock, sizes, sizes_stock FROM products WHERE id = ?').get(id);
    if (!p) return { ok: false, error: 'Hay productos en el carrito que ya no están disponibles.' };
    const res = availabilityForCartLine(p, line.size);
    if (!res.ok) {
      return { ok: false, error: `Tenés que elegir un talle para: ${p.name}` };
    }
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) return { ok: false, error: 'Cantidad inválida en el carrito.' };
    if (qty > res.available) {
      return {
        ok: false,
        error: `Stock insuficiente: "${p.name}"${line.size ? ` (talle ${line.size})` : ''}. Disponible: ${res.available}. Actualizá el carrito.`,
      };
    }
  }
  return { ok: true };
}

function attachImages(product) {
  const imgs = getProductImages(product.id);
  return {
    ...product,
    sizes: JSON.parse(product.sizes || '[]'),
    sizes_stock: JSON.parse(product.sizes_stock || '{}'),
    images: imgs.map(i => ({ id: i.id, filename: i.filename })),
    customer_photos: getCustomerPhotos(product.id).map(p => ({
      id: p.id,
      filename: p.filename,
      caption: p.caption || '',
    })),
  };
}

// ─── Simple SQLite session store (extends EventEmitter as required) ───────────
const Session = require('express-session');

class SqliteStore extends Session.Store {
  _cleanup() {
    db.prepare("DELETE FROM sessions WHERE expired < datetime('now')").run();
  }
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT sess, expired FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb(null, null);
      if (new Date(row.expired) < new Date()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.maxAge ? sess.cookie.maxAge / 1000 : 86400;
      const expired = new Date(Date.now() + ttl * 1000).toISOString();
      const sessStr = JSON.stringify(sess);
      db.prepare(`INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired`)
        .run(sid, sessStr, expired);
      if (cb) cb(null);
    } catch (e) { if (cb) cb(e); }
  }
  destroy(sid, cb) {
    try { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }
}

const sqliteStore = new SqliteStore();

// ─── Passport setup ────────────────────────────────────────────────────────────
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return done(null, false, { message: 'Email o contraseña incorrectos.' });
    if (!user.password) return done(null, false, { message: 'Esta cuenta usa Google. Iniciá sesión con Google.' });
    if (!bcrypt.compareSync(password, user.password)) return done(null, false, { message: 'Email o contraseña incorrectos.' });
    return done(null, user);
  } catch (e) { return done(e); }
}));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const name = profile.displayName;
      const avatar = profile.photos?.[0]?.value;
      const googleId = profile.id;

      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
      if (!user && email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      if (user) {
        db.prepare('UPDATE users SET google_id = ?, avatar = ?, verified = 1 WHERE id = ?').run(googleId, avatar, user.id);
        return done(null, { ...user, google_id: googleId, avatar });
      }

      const result = db.prepare(
        'INSERT INTO users (name, email, google_id, avatar, verified) VALUES (?, ?, ?, ?, 1)'
      ).run(name, email, googleId, avatar);
      const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      return done(null, newUser);
    } catch (e) { return done(e); }
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    const user = db.prepare('SELECT id, name, email, avatar, google_id, created_at FROM users WHERE id = ?').get(id);
    done(null, user || false);
  } catch (e) { done(e); }
});

// ─── Mailer ────────────────────────────────────────────────────────────────────
const emailConfigured = !!(process.env.EMAIL_PASS);

// Use Resend HTTP API directly (more reliable than SMTP in production)
async function sendEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || 'Calziani <no-reply@calziani.com>';
  if (!emailConfigured) return; // dev: already logged to console elsewhere

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Recibo / comprobante de pedido enviado al cliente por email
async function sendOrderReceiptEmail({ to, order }) {
  if (!isValidEmail(to)) return;
  const dopRate = Number(process.env.USD_RATE) || 59.48;
  const fmtUsd = (n) => 'US$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDop = (n) => 'RD$' + Math.round(Number(n) * dopRate).toLocaleString('es-DO');

  const itemsRows = (order.items || []).map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#333">${i.name}${i.size ? ` <span style="color:#999">(${i.size})</span>` : ''} × ${i.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:right;white-space:nowrap">${fmtUsd(i.price * i.qty)}<br><span style="color:#999;font-size:11px">${fmtDop(i.price * i.qty)}</span></td>
    </tr>`).join('');

  const html = `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:0;background:#fff;border:1px solid #e8e8e8">
    <div style="background:#111;padding:24px;text-align:center">
      <h1 style="color:#fff;font-size:20px;font-weight:700;letter-spacing:0.14em;margin:0">CALZIANI</h1>
      <p style="color:#bbb;font-size:12px;margin:6px 0 0;letter-spacing:0.08em">COMPROBANTE DE PEDIDO</p>
    </div>
    <div style="padding:24px">
      <p style="font-size:14px;color:#111;margin:0 0 4px">Hola ${order.name || 'cliente'},</p>
      <p style="font-size:13px;color:#666;margin:0 0 18px">Gracias por tu compra en Calziani. Este es el comprobante de tu pedido.</p>

      <table style="width:100%;font-size:13px;color:#333;margin:0 0 16px">
        <tr><td style="padding:3px 0;color:#888">N.° de pedido</td><td style="padding:3px 0;text-align:right;font-weight:700">${order.orderNumber || '—'}</td></tr>
        ${order.trackingCode ? `<tr><td style="padding:3px 0;color:#888">Código de tracking</td><td style="padding:3px 0;text-align:right;font-weight:700">${order.trackingCode}</td></tr>` : ''}
        <tr><td style="padding:3px 0;color:#888">Fecha</td><td style="padding:3px 0;text-align:right">${order.dateStr || ''}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Método de pago</td><td style="padding:3px 0;text-align:right">${order.method || '—'}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Estado</td><td style="padding:3px 0;text-align:right">${order.statusLabel || 'Recibido'}</td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:0 0 8px">${itemsRows}</table>

      <table style="width:100%;font-size:13px;color:#333;margin:8px 0 0">
        <tr><td style="padding:3px 0;color:#888">Subtotal</td><td style="padding:3px 0;text-align:right">${fmtUsd(order.lineSubtotal)} <span style="color:#999">/ ${fmtDop(order.lineSubtotal)}</span></td></tr>
        ${order.discountAmt ? `<tr><td style="padding:3px 0;color:#888">Descuento${order.promoPct ? ` (−${order.promoPct}%)` : ''}</td><td style="padding:3px 0;text-align:right;color:#16a34a">− ${fmtUsd(order.discountAmt)}</td></tr>` : ''}
        <tr><td style="padding:3px 0;color:#888">Envío</td><td style="padding:3px 0;text-align:right">${fmtUsd(order.shippingFee)} <span style="color:#999">/ ${fmtDop(order.shippingFee)}</span></td></tr>
        <tr><td style="padding:10px 0 0;font-weight:700;font-size:15px;border-top:2px solid #111">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700;font-size:15px;border-top:2px solid #111">${fmtUsd(order.total)}<br><span style="color:#666;font-size:12px">${fmtDop(order.total)} DOP</span></td></tr>
      </table>

      ${order.address ? `<p style="font-size:12px;color:#888;margin:18px 0 0;line-height:1.6"><strong style="color:#555">Envío a:</strong><br>${order.name || ''}<br>${order.address}, ${order.province || ''}<br>${order.country || ''}</p>` : ''}

      <p style="font-size:12px;color:#aaa;margin:22px 0 0;line-height:1.6;border-top:1px solid #eee;padding-top:14px">
        Calziani · Los Jardines Metropolitanos, Santiago de los Caballeros, República Dominicana<br>
        info@calziani.com · +1 809 307-6122<br>
        Consultá nuestras <a href="${process.env.BASE_URL || 'https://calziani.com'}/politicas" style="color:#888">políticas de devolución, envío y seguridad</a>.
      </p>
    </div>
  </div>`;

  try {
    await sendEmail({ to: to.trim(), subject: `Comprobante de tu pedido ${order.orderNumber || ''} — Calziani`, html });
  } catch (e) {
    console.error('[Receipt email]', e.message);
  }
}

async function sendVerificationEmail(toEmail, code) {
  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e8e8e8">
      <h1 style="font-size:20px;font-weight:700;letter-spacing:0.08em;margin:0 0 8px">CALZIANI</h1>
      <p style="font-size:14px;color:#666;margin:0 0 28px">Verificación de cuenta</p>
      <p style="font-size:14px;color:#111;margin:0 0 20px">Tu código de verificación es:</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:0.18em;color:#111;text-align:center;padding:20px;background:#f5f5f5;border-radius:4px;margin:0 0 24px">${code}</div>
      <p style="font-size:12px;color:#aaa;margin:0">Este código expira en 10 minutos. Si no creaste una cuenta en Calziani, ignorá este mensaje.</p>
    </div>`;

  if (!emailConfigured) {
    console.log(`\n📧  [DEV] Código de verificación para ${toEmail}: ${code}\n`);
    return;
  }
  await sendEmail({ to: toEmail, subject: 'Tu código de verificación — Calziani', html });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(Session({
  secret: process.env.SESSION_SECRET || 'calziani_dev_secret',
  resave: false,
  saveUninitialized: false,
  store: sqliteStore,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
// In production, serve uploaded images from the persistent volume
if (process.env.DATA_DIR) {
  app.use('/img/products', express.static(path.join(process.env.DATA_DIR, 'img', 'products')));
  app.use('/img/customer-photos', express.static(path.join(process.env.DATA_DIR, 'img', 'customer-photos')));
}

// Clean expired sessions every hour
setInterval(() => sqliteStore._cleanup(), 60 * 60 * 1000);

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const parts = Buffer.from(token, 'base64').toString('utf8').split(':');
  if (parts.length !== 2) return res.status(401).json({ error: 'Token inválido' });

  const [username, password] = parts;
  const admin = db.prepare('SELECT id FROM admin WHERE username = ? AND password = ?').get(username, password);
  if (!admin) return res.status(401).json({ error: 'Credenciales incorrectas' });
  next();
}

// ─── Public routes ─────────────────────────────────────────────────────────────

app.get('/api/brands', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM brands ORDER BY name ASC').all());
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

app.post('/api/admin/brands', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' });
  const exists = db.prepare('SELECT 1 FROM brands WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: `La marca "${name}" ya existe.` });
  const result = db.prepare('INSERT INTO brands (name) VALUES (?)').run(name);
  res.status(201).json({ id: result.lastInsertRowid, name });
});

app.put('/api/admin/brands/:id', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' });
  const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marca no encontrada.' });
  const dup = db.prepare('SELECT 1 FROM brands WHERE name = ? AND id != ?').get(name, req.params.id);
  if (dup) return res.status(409).json({ error: `La marca "${name}" ya existe.` });
  db.prepare('UPDATE brands SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/brands/:id', requireAuth, (req, res) => {
  const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marca no encontrada.' });
  db.prepare('UPDATE products SET brand_id = NULL WHERE brand_id = ?').run(req.params.id);
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/products', (req, res) => {
  const { category, search, size, brand_id } = req.query;
  const pageNum  = parseInt(req.query.page);
  const limitNum = parseInt(req.query.limit) || 12;
  const paginate = !isNaN(pageNum) && pageNum >= 1;

  let query = `
    SELECT p.*, b.name AS brand_name
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
  `;
  const params = [];
  const conditions = [];

  if (category && category !== 'all') { conditions.push('p.category = ?'); params.push(category); }
  if (brand_id && brand_id !== 'all') { conditions.push('p.brand_id = ?'); params.push(Number(brand_id)); }
  if (search && search.trim()) {
    conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY p.created_at DESC';

  try {
    let products = db.prepare(query).all(...params);

    if (size && size !== 'all') {
      products = products.filter(p => {
        try { return JSON.parse(p.sizes || '[]').includes(size); } catch { return false; }
      });
    }

    const total = products.length;

    if (paginate) {
      const offset = (pageNum - 1) * limitNum;
      products = products.slice(offset, offset + limitNum);
    }

    // Attach first image only (for card display performance)
    products = products.map(p => {
      const firstImg = db.prepare(
        'SELECT filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC LIMIT 1'
      ).get(p.id);
      const photoCount = p.category === 'calzado' ? customerPhotoCount(p.id) : 0;
      return {
        ...p,
        sizes: JSON.parse(p.sizes || '[]'),
        sizes_stock: JSON.parse(p.sizes_stock || '{}'),
        cover: firstImg ? firstImg.filename : null,
        customer_photo_count: photoCount,
      };
    });

    if (paginate) {
      res.json({ products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    } else {
      res.json(products);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// ─── Bulk product fetch by IDs (for favorites page) ───────────────────────────
app.get('/api/products/by-ids', (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  try {
    let products = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...ids);
    products = products.map(p => {
      const firstImg = db.prepare(
        'SELECT filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC LIMIT 1'
      ).get(p.id);
      const photoCount = p.category === 'calzado' ? customerPhotoCount(p.id) : 0;
      return {
        ...p,
        sizes: JSON.parse(p.sizes || '[]'),
        sizes_stock: JSON.parse(p.sizes_stock || '{}'),
        cover: firstImg ? firstImg.filename : null,
        customer_photo_count: photoCount,
      };
    });
    res.json(products);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/customer-photos', (req, res) => {
  try {
    const productId = req.query.product_id != null ? Number(req.query.product_id) : null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 60);

    let rows;
    if (Number.isFinite(productId) && productId > 0) {
      rows = db.prepare(`
        SELECT cp.id, cp.filename, cp.caption, cp.product_id, p.name AS product_name
        FROM customer_photos cp
        JOIN products p ON p.id = cp.product_id
        WHERE cp.active = 1
        ORDER BY CASE WHEN cp.product_id = ? THEN 0 ELSE 1 END, cp.position ASC, cp.created_at DESC
        LIMIT ?
      `).all(productId, limit);
    } else {
      rows = db.prepare(`
        SELECT cp.id, cp.filename, cp.caption, cp.product_id, p.name AS product_name
        FROM customer_photos cp
        JOIN products p ON p.id = cp.product_id
        WHERE cp.active = 1
        ORDER BY cp.created_at DESC, cp.position ASC
        LIMIT ?
      `).all(limit);
    }
    res.json(rows);
  } catch (e) {
    console.error('customer-photos public:', e);
    res.status(500).json({ error: 'Error al obtener testimonios.' });
  }
});

app.get('/api/admin/customer-photos', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT cp.*, p.name AS product_name, p.category AS product_category
      FROM customer_photos cp
      JOIN products p ON p.id = cp.product_id
      WHERE (cp.rating IS NULL OR cp.rating NOT BETWEEN 1 AND 5)
        AND trim(COALESCE(cp.review_text, '')) = ''
      ORDER BY cp.created_at DESC, cp.id DESC
    `).all();
    res.json(rows);
  } catch (e) {
    console.error('customer-photos list:', e);
    res.status(500).json({ error: 'Error al obtener fotos de clientes.' });
  }
});

app.post('/api/admin/customer-photos', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const productId = Number(req.body?.product_id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Seleccioná un producto.' });
    }
    const product = db.prepare('SELECT id, category FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
    if (product.category !== 'calzado') {
      return res.status(400).json({ error: 'Solo podés asociar fotos a productos de calzado.' });
    }
    if (!req.file?.buffer) return res.status(400).json({ error: 'Subí una imagen.' });

    const caption = String(req.body?.caption || '').trim().slice(0, 120);
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM customer_photos WHERE product_id = ?'
    ).get(productId).m;
    const filename = await processAndSaveCustomerPhoto(req.file.buffer);
    const result = db.prepare(`
      INSERT INTO customer_photos (product_id, filename, caption, position, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(productId, filename, caption, maxPos + 1);

    res.status(201).json({
      id: result.lastInsertRowid,
      product_id: productId,
      filename,
      caption,
      position: maxPos + 1,
      active: 1,
    });
  } catch (e) {
    console.error('customer-photos create:', e);
    res.status(500).json({ error: e.message || 'Error al guardar la foto.' });
  }
});

app.put('/api/admin/customer-photos/:id', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Foto no encontrada.' });

    const caption = req.body?.caption != null ? String(req.body.caption).trim().slice(0, 120) : row.caption;
    const active = req.body?.active != null ? (req.body.active ? 1 : 0) : row.active;
    let productId = row.product_id;

    if (req.body?.product_id != null) {
      productId = Number(req.body.product_id);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Producto inválido.' });
      }
      const product = db.prepare('SELECT id, category FROM products WHERE id = ?').get(productId);
      if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
      if (product.category !== 'calzado') {
        return res.status(400).json({ error: 'Solo podés asociar fotos a productos de calzado.' });
      }
    }

    db.prepare(`
      UPDATE customer_photos SET product_id = ?, caption = ?, active = ? WHERE id = ?
    `).run(productId, caption, active, req.params.id);

    res.json({ ok: true });
  } catch (e) {
    console.error('customer-photos update:', e);
    res.status(500).json({ error: 'Error al actualizar la foto.' });
  }
});

app.delete('/api/admin/customer-photos/:id', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Foto no encontrada.' });
    db.prepare('DELETE FROM customer_photos WHERE id = ?').run(req.params.id);
    deleteCustomerPhotoFile(row.filename);
    res.json({ ok: true });
  } catch (e) {
    console.error('customer-photos delete:', e);
    res.status(500).json({ error: 'Error al eliminar la foto.' });
  }
});

function normalizeSqliteDatetime(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s.replace('T', ' ')}:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return null;
}

function isReviewRow(row) {
  const rating = Number(row?.rating);
  const text = String(row?.review_text || '').trim();
  return (Number.isFinite(rating) && rating >= 1 && rating <= 5) || text.length > 0;
}

app.get('/api/admin/reviews', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT cp.*, p.name AS product_name, p.category AS product_category
      FROM customer_photos cp
      JOIN products p ON p.id = cp.product_id
      WHERE (cp.rating IS NOT NULL AND cp.rating BETWEEN 1 AND 5)
         OR trim(COALESCE(cp.review_text, '')) != ''
      ORDER BY cp.created_at DESC, cp.id DESC
    `).all();
    res.json(rows);
  } catch (e) {
    console.error('admin reviews list:', e);
    res.status(500).json({ error: 'Error al obtener reseñas.' });
  }
});

app.put('/api/admin/reviews/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reseña no encontrada.' });
    if (!isReviewRow(row)) return res.status(400).json({ error: 'Este registro no es una reseña.' });

    const rating = req.body?.rating != null ? Number(req.body.rating) : row.rating;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Calificación inválida (1-5).' });
    }

    const review_text = req.body?.review_text != null
      ? String(req.body.review_text).trim().slice(0, 800)
      : String(row.review_text || '').trim();
    if (!review_text) return res.status(400).json({ error: 'La reseña no puede estar vacía.' });

    const reviewer_name = req.body?.reviewer_name != null
      ? String(req.body.reviewer_name).trim().slice(0, 80)
      : String(row.reviewer_name || 'Cliente').trim();
    if (!reviewer_name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const active = req.body?.active != null ? (req.body.active === '1' || req.body.active === true || req.body.active === 'true' ? 1 : 0) : row.active;

    let productId = row.product_id;
    if (req.body?.product_id != null) {
      productId = Number(req.body.product_id);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Producto inválido.' });
      }
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    let created_at = row.created_at;
    if (req.body?.created_at != null) {
      const parsed = normalizeSqliteDatetime(req.body.created_at);
      if (!parsed) return res.status(400).json({ error: 'Fecha inválida.' });
      created_at = parsed;
    }

    let filename = row.filename || '';
    const removePhoto = req.body?.remove_photo === '1' || req.body?.remove_photo === true || req.body?.remove_photo === 'true';
    if (removePhoto && filename) {
      deleteCustomerPhotoFile(filename);
      filename = '';
    }
    if (req.file?.buffer) {
      if (filename) deleteCustomerPhotoFile(filename);
      filename = await processAndSaveCustomerPhoto(req.file.buffer);
    }

    db.prepare(`
      UPDATE customer_photos
      SET product_id = ?, filename = ?, review_text = ?, rating = ?, reviewer_name = ?, active = ?, created_at = ?
      WHERE id = ?
    `).run(productId, filename, review_text, rating, reviewer_name, active, created_at, req.params.id);

    res.json({ ok: true, photo: filename || null });
  } catch (e) {
    console.error('admin reviews update:', e);
    res.status(500).json({ error: 'Error al actualizar la reseña.' });
  }
});

app.delete('/api/admin/reviews/:id', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reseña no encontrada.' });
    if (!isReviewRow(row)) return res.status(400).json({ error: 'Este registro no es una reseña.' });
    db.prepare('DELETE FROM customer_photos WHERE id = ?').run(req.params.id);
    deleteCustomerPhotoFile(row.filename);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin reviews delete:', e);
    res.status(500).json({ error: 'Error al eliminar la reseña.' });
  }
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(attachImages(product));
});

app.get('/api/products/:id/stock', (req, res) => {
  const product = db.prepare('SELECT id, stock, sizes, sizes_stock FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  let sizes_stock = {};
  let sizes = [];
  try { sizes_stock = JSON.parse(product.sizes_stock || '{}'); } catch { sizes_stock = {}; }
  try { sizes = JSON.parse(product.sizes || '[]'); } catch { sizes = []; }
  res.json({ stock: product.stock, sizes, by_size: sizes_stock });
});

app.get('/api/products/:id/reviews', (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Producto inválido.' });
    }
    const rows = db.prepare(`
      SELECT id, rating, review_text, reviewer_name, caption, filename, created_at
      FROM customer_photos
      WHERE product_id = ? AND active = 1
        AND (rating IS NOT NULL OR trim(COALESCE(review_text, '')) != '')
      ORDER BY created_at DESC
    `).all(productId);

    const rated = rows.filter(r => r.rating >= 1 && r.rating <= 5);
    const avg_rating = rated.length
      ? Math.round(rated.reduce((s, r) => s + r.rating, 0) / rated.length * 10) / 10
      : 0;

    res.json({
      avg_rating,
      count: rows.length,
      reviews: rows.map(r => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text || r.caption || '',
        reviewer_name: r.reviewer_name || 'Cliente',
        photo: r.filename || null,
        created_at: r.created_at,
      })),
    });
  } catch (e) {
    console.error('product reviews GET:', e);
    res.status(500).json({ error: 'Error al obtener reseñas.' });
  }
});

app.post('/api/products/:id/reviews', upload.single('image'), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Producto inválido.' });
    }
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

    const rating = Number(req.body?.rating);
    const review_text = String(req.body?.review_text || '').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Calificación inválida (1-5).' });
    }
    if (review_text.length < 10) {
      return res.status(400).json({ error: 'La reseña debe tener al menos 10 caracteres.' });
    }

    let reviewer_name = String(req.body?.name || '').trim();
    const userId = req.user?.id || null;
    if (userId && !reviewer_name) reviewer_name = req.user.name || 'Cliente';
    if (!reviewer_name) return res.status(400).json({ error: 'Ingresá tu nombre.' });

    let filename = '';
    if (req.file?.buffer) {
      filename = await processAndSaveCustomerPhoto(req.file.buffer);
    }

    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM customer_photos WHERE product_id = ?'
    ).get(productId).m;

    const result = db.prepare(`
      INSERT INTO customer_photos (product_id, filename, caption, review_text, rating, reviewer_name, user_id, active, position)
      VALUES (?, ?, '', ?, ?, ?, ?, 1, ?)
    `).run(productId, filename, review_text, rating, reviewer_name, userId, maxPos + 1);

    res.status(201).json({ ok: true, id: result.lastInsertRowid, photo: filename || null });
  } catch (e) {
    console.error('product reviews POST:', e);
    res.status(500).json({ error: 'Error al guardar la reseña.' });
  }
});

app.get('/api/products/:id/related', (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Producto inválido.' });
  }
  const product = db.prepare('SELECT id, category, brand_id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 12);
  let related = db.prepare(`
    SELECT * FROM products
    WHERE id != ? AND category = ?
    ORDER BY
      CASE WHEN brand_id IS NOT NULL AND brand_id = ? THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT ?
  `).all(productId, product.category, product.brand_id || -1, limit);

  related = related.map(p => {
    const firstImg = db.prepare(
      'SELECT filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC LIMIT 1'
    ).get(p.id);
    const photoCount = p.category === 'calzado' ? customerPhotoCount(p.id) : 0;
    return {
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      sizes_stock: JSON.parse(p.sizes_stock || '{}'),
      cover: firstImg ? firstImg.filename : null,
      customer_photo_count: photoCount,
    };
  });

  res.json(related);
});

// ─── User auth routes ──────────────────────────────────────────────────────────

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, avatar: req.user.avatar } });
});

// Direct register (no email verification)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'El email es obligatorio.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  const emailLc = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLc);
  if (existing) return res.status(400).json({ error: 'Ya existe una cuenta con ese email.' });

  try {
    const hash   = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password, verified) VALUES (?, ?, ?, 1)').run(name.trim(), emailLc, hash);
    const user   = db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(result.lastInsertRowid);
    req.login(user, err => {
      if (err) return res.status(500).json({ error: 'Error al iniciar sesión.' });
      res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

// Step 1 — send verification code
app.post('/api/auth/send-code', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'El email es obligatorio.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  const emailLc = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id, google_id FROM users WHERE email = ?').get(emailLc);
  if (existing && !existing.google_id) return res.status(400).json({ error: 'Ya existe una cuenta con ese email.' });

  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate previous codes for this email
    db.prepare('DELETE FROM verification_codes WHERE email = ?').run(emailLc);
    db.prepare('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)').run(emailLc, code, expiresAt);

    await sendVerificationEmail(emailLc, code);
    res.json({ message: 'Código enviado.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al enviar el código. Revisá el email ingresado.' });
  }
});

// Step 2 — verify code and create account
app.post('/api/auth/verify-code', async (req, res) => {
  const { name, email, password, code } = req.body || {};
  if (!code || !code.trim()) return res.status(400).json({ error: 'Ingresá el código.' });

  const emailLc = email?.toLowerCase().trim();
  const row = db.prepare(
    'SELECT * FROM verification_codes WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).get(emailLc);

  if (!row) return res.status(400).json({ error: 'No hay un código pendiente para este email.' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM verification_codes WHERE email = ?').run(emailLc);
    return res.status(400).json({ error: 'El código expiró. Solicitá uno nuevo.' });
  }
  if (row.code !== code.trim()) return res.status(400).json({ error: 'Código incorrecto.' });

  try {
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);

    const hash = bcrypt.hashSync(password, 10);
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailLc);

    if (user) {
      // Google-linked account — add password
      db.prepare('UPDATE users SET name = ?, password = ?, verified = 1 WHERE id = ?').run(name.trim(), hash, user.id);
    } else {
      const result = db.prepare(
        'INSERT INTO users (name, email, password, verified) VALUES (?, ?, ?, 1)'
      ).run(name.trim(), emailLc, hash);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    req.login(user, err => {
      if (err) return res.status(500).json({ error: 'Error al iniciar sesión.' });
      res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

app.post('/api/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Credenciales incorrectas.' });
    req.login(user, err2 => {
      if (err2) return next(err2);
      res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    });
  })(req, res, next);
});

app.post('/api/auth/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
    res.json({ message: 'Sesión cerrada.' });
  });
});

// ─── Forgot / Reset password ───────────────────────────────────────────────────

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'El email es obligatorio.' });

  const emailLc = email.toLowerCase().trim();
  // Always respond 200 to prevent email enumeration
  const user = db.prepare('SELECT id, name FROM users WHERE email = ? AND password IS NOT NULL').get(emailLc);
  if (!user) return res.json({ message: 'Si ese email existe, recibirás un enlace.' });

  try {
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    db.prepare('DELETE FROM password_resets WHERE email = ?').run(emailLc);
    db.prepare('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)').run(emailLc, token, expiresAt);

    const baseUrl   = process.env.BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    if (!emailConfigured) {
      console.log(`\n🔑  [DEV] Enlace para resetear contraseña de ${emailLc}:\n    ${resetLink}\n`);
    } else {
      const html = `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e8e8e8">
          <h1 style="font-size:20px;font-weight:700;letter-spacing:0.08em;margin:0 0 8px">CALZIANI</h1>
          <p style="font-size:14px;color:#666;margin:0 0 24px">Recuperación de contraseña</p>
          <p style="font-size:14px;color:#111;margin:0 0 20px">Hola ${user.name}, recibimos una solicitud para restablecer tu contraseña.</p>
          <a href="${resetLink}" style="display:block;text-align:center;background:#111;color:#fff;padding:14px 24px;font-size:14px;font-weight:700;letter-spacing:0.08em;text-decoration:none;border-radius:2px;margin:0 0 20px">Restablecer contraseña</a>
          <p style="font-size:12px;color:#aaa;margin:0">Este enlace expira en 30 minutos. Si no solicitaste esto, ignorá este mensaje.</p>
        </div>`;
      await sendEmail({ to: emailLc, subject: 'Restablecer tu contraseña — Calziani', html });
    }

    res.json({ message: 'Si ese email existe, recibirás un enlace.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token inválido.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  const row = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token);
  if (!row) return res.status(400).json({ error: 'El enlace no es válido o ya fue usado.' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_resets WHERE token = ?').run(token);
    return res.status(400).json({ error: 'El enlace expiró. Solicitá uno nuevo.' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hash, row.email);
    db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(token);
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar la contraseña.' });
  }
});

app.get('/api/auth/validate-reset-token', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false });
  const row = db.prepare('SELECT expires_at, used FROM password_resets WHERE token = ?').get(token);
  if (!row || row.used || new Date(row.expires_at) < new Date()) return res.json({ valid: false });
  res.json({ valid: true });
});

// Google OAuth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=error' }),
  (req, res) => res.redirect('/?auth=success')
);

app.get('/api/auth/google-enabled', (req, res) => {
  res.json({ enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

// ─── Admin routes ──────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  const admin = db.prepare('SELECT id FROM admin WHERE username = ? AND password = ?').get(username, password);
  if (!admin) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  res.json({ token, message: 'Login exitoso' });
});

app.post('/api/admin/products', requireAuth, upload.array('images', 10), async (req, res) => {
  const { name, description, price, category, stock, sizes, sizes_stock, shipping_days, compare_price, brand_id } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'El precio debe ser un número válido' });
  if (!['calzado', 'ropa', 'accesorio'].includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  let parsedSizes;
  try { parsedSizes = JSON.parse(sizes || '[]'); } catch { parsedSizes = []; }
  let parsedSizesStock;
  try { parsedSizesStock = JSON.parse(sizes_stock || '{}'); } catch { parsedSizesStock = {}; }
  const totalStock = Object.values(parsedSizesStock).reduce((s, v) => s + Number(v || 0), 0) || Number(stock) || 0;
  const compPrice = compare_price && !isNaN(Number(compare_price)) && Number(compare_price) > 0 ? Number(compare_price) : null;
  const shipDays = shipping_days && String(shipping_days).trim() ? String(shipping_days).trim() : null;
  const brandId = brand_id && !isNaN(Number(brand_id)) && Number(brand_id) > 0 ? Number(brand_id) : null;

  try {
    const result = db.prepare(
      'INSERT INTO products (name, description, price, category, stock, sizes, sizes_stock, shipping_days, compare_price, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name.trim(), (description || '').trim(), Number(price),
      category, totalStock,
      JSON.stringify(Array.isArray(parsedSizes) ? parsedSizes : []),
      JSON.stringify(parsedSizesStock),
      shipDays, compPrice, brandId
    );

    const productId = result.lastInsertRowid;

    // Save uploaded images
    if (req.files && req.files.length) {
      const insertImg = db.prepare(
        'INSERT INTO product_images (product_id, filename, position) VALUES (?, ?, ?)'
      );
      for (let i = 0; i < req.files.length; i++) {
        const filename = await processAndSaveImage(req.files[i].buffer);
        insertImg.run(productId, filename, i);
      }
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    res.status(201).json(attachImages(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/admin/products/:id', requireAuth, upload.array('images', 10), async (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, description, price, category, stock, sizes, sizes_stock, shipping_days, compare_price, remove_image_ids, brand_id } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'El precio debe ser un número válido' });
  if (!['calzado', 'ropa', 'accesorio'].includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  let parsedSizes;
  try { parsedSizes = JSON.parse(sizes || '[]'); } catch { parsedSizes = []; }
  let parsedSizesStock;
  try { parsedSizesStock = JSON.parse(sizes_stock || '{}'); } catch { parsedSizesStock = {}; }
  const totalStock = Object.values(parsedSizesStock).reduce((s, v) => s + Number(v || 0), 0) || Number(stock) || 0;
  const compPrice = compare_price && !isNaN(Number(compare_price)) && Number(compare_price) > 0 ? Number(compare_price) : null;
  const shipDays = shipping_days && String(shipping_days).trim() ? String(shipping_days).trim() : null;
  const brandId = brand_id && !isNaN(Number(brand_id)) && Number(brand_id) > 0 ? Number(brand_id) : null;

  try {
    // Delete images marked for removal
    let removeIds = [];
    try { removeIds = JSON.parse(remove_image_ids || '[]'); } catch { removeIds = []; }
    for (const imgId of removeIds) {
      const img = db.prepare('SELECT filename FROM product_images WHERE id = ? AND product_id = ?').get(imgId, req.params.id);
      if (img) {
        deleteImageFile(img.filename);
        db.prepare('DELETE FROM product_images WHERE id = ?').run(imgId);
      }
    }

    // Save new uploaded images (appended after existing)
    if (req.files && req.files.length) {
      const maxPos = db.prepare(
        'SELECT COALESCE(MAX(position), -1) as mp FROM product_images WHERE product_id = ?'
      ).get(req.params.id).mp;

      const insertImg = db.prepare(
        'INSERT INTO product_images (product_id, filename, position) VALUES (?, ?, ?)'
      );
      for (let i = 0; i < req.files.length; i++) {
        const filename = await processAndSaveImage(req.files[i].buffer);
        insertImg.run(req.params.id, filename, maxPos + 1 + i);
      }
    }

    db.prepare(
      `UPDATE products SET name = ?, description = ?, price = ?, category = ?, stock = ?, sizes = ?,
       sizes_stock = ?, shipping_days = ?, compare_price = ?, brand_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      name.trim(), (description || '').trim(), Number(price),
      category, totalStock,
      JSON.stringify(Array.isArray(parsedSizes) ? parsedSizes : []),
      JSON.stringify(parsedSizesStock),
      shipDays, compPrice, brandId,
      req.params.id,
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(attachImages(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  try {
    // Delete all image files first
    const imgs = getProductImages(req.params.id);
    imgs.forEach(img => deleteImageFile(img.filename));

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

app.put('/api/admin/password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const token = req.headers['x-admin-token'];
    const username = Buffer.from(token, 'base64').toString('utf8').split(':')[0];
    db.prepare('UPDATE admin SET password = ? WHERE username = ?').run(newPassword, username);
    const newToken = Buffer.from(`${username}:${newPassword}`).toString('base64');
    res.json({ token: newToken, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// ─── Currency rates ───────────────────────────────────────────────────────────
app.get('/api/currency-rates', (req, res) => {
  res.json({
    USD: 1,
    EUR: Number(process.env.EUR_RATE) || 0.92,
    DOP: Number(process.env.USD_RATE) || 59.48,
  });
});

// ─── Payment config (public, for frontend) ────────────────────────────────────
app.get('/api/payment-config', (req, res) => {
  res.json({
    usdRate: Number(process.env.USD_RATE) || 57,
    bankName:   process.env.BANK_NAME   || '',
    bankAccount:process.env.BANK_ACCOUNT|| '',
    bankHolder: process.env.BANK_HOLDER || '',
    bankType:   process.env.BANK_TYPE   || '',
    whatsapp:   process.env.WHATSAPP_NUMBER || '',
  });
});

const CHECKOUT_SHIPPING_USD = 5;

// ─── Tracking ──────────────────────────────────────────────────────────────────
const TRACKING_STAGES = ['received', 'in_europe', 'in_usa', 'in_dominican_republic', 'delivered'];

function generateTrackingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CLZ-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function uniqueTrackingCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateTrackingCode();
    const exists = db.prepare('SELECT 1 FROM orders WHERE tracking_code = ?').get(code);
    if (!exists) return code;
  }
  return `CLZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function trackingUrlFromCode(req, trackingCode) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  const base = host ? `${proto}://${host}` : (process.env.BASE_URL || 'http://localhost:3000');
  return `${base}/tracking?code=${encodeURIComponent(trackingCode)}`;
}

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

/** Solo dígitos, mínimo 8 para considerar teléfono válido */
function normalizePhoneKey(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 8 ? d : '';
}

/**
 * Aplica descuento al carrito (sin envío), respetando productos excluidos.
 * cart: array de { id, price, qty }
 * Una vez por teléfono en BD.
 */
// Marcas con piso de precio: nunca se venden por debajo de este monto (USD), aunque un código dé menos.
const GOLDEN_FLOOR_USD = 350;

function getGoldenFloorIds() {
  try {
    const rows = db.prepare(`
      SELECT p.id FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE LOWER(b.name) LIKE '%golden%'
         OR LOWER(p.name) LIKE '%golden goose%'
    `).all();
    return new Set(rows.map(r => Number(r.id)));
  } catch { return new Set(); }
}

// Philippe Model: el cupón no aplica (ni en checkout ni en precio mostrado).
function getPhilippeExcludedIds() {
  try {
    const rows = db.prepare(`
      SELECT p.id FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE LOWER(b.name) LIKE '%philippe%'
         OR LOWER(p.name) LIKE '%philippe model%'
    `).all();
    return new Set(rows.map(r => Number(r.id)));
  } catch { return new Set(); }
}

function mergePromoExcludedIds(promoExcluded = []) {
  const ids = new Set((promoExcluded || []).map(Number).filter(Boolean));
  for (const id of getPhilippeExcludedIds()) ids.add(id);
  return [...ids];
}

// Subtotal con descuento aplicando exclusiones y piso de precio por marca (Golden $350).
// Misma fórmula exacta que el cliente, para que el total validado coincida.
function computeDiscountedSubtotal(cart, percent, excludedIds, floorIds) {
  let subtotal = 0;
  for (const i of cart) {
    const unit = Number(i.price);
    const qty  = Number(i.qty);
    let lineUnit = unit;
    if (!excludedIds.includes(Number(i.id))) {
      lineUnit = unit * (100 - percent) / 100;
      if (floorIds.has(Number(i.id))) {
        lineUnit = Math.max(lineUnit, Math.min(unit, GOLDEN_FLOOR_USD));
      }
    }
    subtotal += lineUnit * qty;
  }
  return Math.round(subtotal * 100) / 100;
}

function applyPromoCalziani(cart, promoCodeRaw, phone) {
  const lineSubtotal = cart.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const code = normalizePromoCode(promoCodeRaw);
  if (!code) return { ok: true, discountedSubtotal: lineSubtotal, redeem: false };

  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
  if (!promo) return { ok: true, discountedSubtotal: lineSubtotal, redeem: false };
  if (!promo.active) return { ok: false, error: `El código ${code} no está disponible.` };
  if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
    return { ok: false, error: `El código ${code} ha expirado.` };
  }

  const phoneKey = normalizePhoneKey(phone);
  if (!phoneKey) {
    return { ok: false, error: `Completá un teléfono válido para usar el código ${code}.` };
  }
  const taken = db.prepare(
    'SELECT 1 FROM promo_redemptions WHERE promo_code = ? AND phone_key = ?'
  ).get(code, phoneKey);
  if (taken) {
    return { ok: false, error: 'Este código ya fue utilizado con este número de teléfono.' };
  }

  const excludedIds = mergePromoExcludedIds(JSON.parse(promo.excluded_product_ids || '[]'));
  const floorIds = getGoldenFloorIds();
  const { percent } = promo;
  const discountedSubtotal = computeDiscountedSubtotal(cart, percent, excludedIds, floorIds);
  return { ok: true, discountedSubtotal, redeem: true, phoneKey, code, percent };
}

// ─── Public: validate promo code (no redemption yet) ──────────────────────────
// Devuelve todos los códigos activos y no expirados (sin revelar el código exacto, solo info de descuento)
app.get('/api/promos/active', (req, res) => {
  try {
    const now   = new Date().toISOString();
    const promos = db.prepare(`
      SELECT code, percent, excluded_product_ids
      FROM promo_codes
      WHERE active = 1
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY percent DESC
    `).all(now);
    const floorIds = [...getGoldenFloorIds()];
    res.json(promos.map(p => ({
      code:               p.code,
      percent:            p.percent,
      excludedProductIds: mergePromoExcludedIds(JSON.parse(p.excluded_product_ids || '[]')),
      floorProductIds:    floorIds,
      floorAmount:        GOLDEN_FLOOR_USD,
    })));
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/promo/validate', (req, res) => {
  const code = normalizePromoCode(req.body?.code);
  if (!code) return res.status(400).json({ error: 'Ingresá un código.' });

  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
  if (!promo || !promo.active) return res.status(404).json({ error: 'Código no válido.' });
  if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
    return res.status(400).json({ error: `El código ${code} ha expirado.` });
  }

  const excludedProductIds = mergePromoExcludedIds(JSON.parse(promo.excluded_product_ids || '[]'));
  res.json({
    ok: true, code, percent: promo.percent, excludedProductIds,
    floorProductIds: [...getGoldenFloorIds()],
    floorAmount: GOLDEN_FLOOR_USD,
  });
});

// ─── Admin: promo codes CRUD ───────────────────────────────────────────────────
app.get('/api/admin/promos', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    ...r,
    excluded_product_ids: JSON.parse(r.excluded_product_ids || '[]'),
  })));
});

app.post('/api/admin/promos', requireAuth, (req, res) => {
  const { code, percent, active = 1, expires_at = null, excluded_product_ids = [] } = req.body || {};
  const c = normalizePromoCode(code);
  if (!c) return res.status(400).json({ error: 'El código no puede estar vacío.' });
  if (!/^[A-Z0-9_-]+$/.test(c)) return res.status(400).json({ error: 'El código solo puede contener letras, números, guiones y guiones bajos.' });
  const pct = Number(percent);
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    return res.status(400).json({ error: 'El descuento debe ser un número entero entre 1 y 100.' });
  }
  const exists = db.prepare('SELECT 1 FROM promo_codes WHERE code = ?').get(c);
  if (exists) return res.status(409).json({ error: `El código ${c} ya existe.` });

  db.prepare(
    `INSERT INTO promo_codes (code, percent, active, expires_at, excluded_product_ids) VALUES (?, ?, ?, ?, ?)`
  ).run(c, pct, active ? 1 : 0, expires_at || null, JSON.stringify(excluded_product_ids));

  res.json({ ok: true, code: c });
});

app.put('/api/admin/promos/:code', requireAuth, (req, res) => {
  const code = normalizePromoCode(req.params.code);
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
  if (!promo) return res.status(404).json({ error: 'Código no encontrado.' });

  const { percent, active, expires_at, excluded_product_ids } = req.body || {};
  const pct = percent !== undefined ? Number(percent) : promo.percent;
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    return res.status(400).json({ error: 'El descuento debe ser un número entero entre 1 y 100.' });
  }
  const newActive   = active !== undefined ? (active ? 1 : 0) : promo.active;
  const newExpires  = expires_at !== undefined ? (expires_at || null) : promo.expires_at;
  const newExcluded = excluded_product_ids !== undefined
    ? JSON.stringify(excluded_product_ids)
    : promo.excluded_product_ids;

  db.prepare(
    `UPDATE promo_codes SET percent=?, active=?, expires_at=?, excluded_product_ids=? WHERE code=?`
  ).run(pct, newActive, newExpires, newExcluded, code);

  res.json({ ok: true });
});

app.delete('/api/admin/promos/:code', requireAuth, (req, res) => {
  const code = normalizePromoCode(req.params.code);
  const result = db.prepare('DELETE FROM promo_codes WHERE code = ?').run(code);
  if (!result.changes) return res.status(404).json({ error: 'Código no encontrado.' });
  res.json({ ok: true });
});

app.post('/api/orders/whatsapp-submit', (req, res) => {
  try {
    const { cart, shipping, subtotal, shippingFee, total, promoCode } = req.body || {};
    if (!Array.isArray(cart) || !cart.length) {
      return res.status(400).json({ error: 'Carrito vacío.' });
    }
    const s = shipping || {};
    if (!String(s.name || '').trim() || !String(s.phone || '').trim() || !String(s.country || '').trim()
        || !String(s.province || '').trim() || !String(s.address || '').trim()) {
      return res.status(400).json({ error: 'Datos de envío incompletos.' });
    }
    const lineSubtotal = cart.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
    const fee = Number(shippingFee);
    const shipFee = Number.isFinite(fee) && fee >= 0 ? fee : CHECKOUT_SHIPPING_USD;
    if (Math.abs(shipFee - CHECKOUT_SHIPPING_USD) > 0.02) {
      return res.status(400).json({ error: 'Costo de envío no válido.' });
    }

    const stockCheck = validateCartStock(cart);
    if (!stockCheck.ok) return res.status(400).json({ error: stockCheck.error });

    const promoRes = applyPromoCalziani(cart, promoCode, s.phone);
    if (!promoRes.ok) return res.status(400).json({ error: promoRes.error });

    const discountedSubtotal = promoRes.discountedSubtotal;
    const totalCheck = Math.round((discountedSubtotal + shipFee) * 100) / 100;
    const clientTotal = Number(total);
    const clientSub = Number(subtotal);
    if (!Number.isFinite(clientTotal) || Math.abs(totalCheck - clientTotal) > 0.02) {
      return res.status(400).json({ error: 'Total no coincide.' });
    }
    if (!Number.isFinite(clientSub) || Math.abs(discountedSubtotal - clientSub) > 0.02) {
      return res.status(400).json({ error: 'Subtotal no coincide.' });
    }

    // Duplicate guard: reject if an identical order (same phone + same total) was placed in the last 2 minutes
    const normalizedPhone = String(s.phone).replace(/\D/g, '');
    const recentDuplicate = db.prepare(`
      SELECT order_number FROM orders
      WHERE total = ?
        AND created_at >= datetime('now', '-2 minutes')
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
              json_extract(items_json, '$.shipping.phone'),
            ' ',''),'-',''),'(',''),')',''),'+','') = ?
        AND status = 'pending_transfer'
      LIMIT 1
    `).get(totalCheck, normalizedPhone);
    if (recentDuplicate) {
      return res.status(409).json({
        error: `Ya existe un pedido reciente con estos datos (${recentDuplicate.order_number}). Si querés hacer otro pedido, esperá unos minutos.`,
      });
    }

    const customerEmail = isValidEmail(s.email) ? String(s.email).trim() : null;
    const orderNum = `CAL-W${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const payload = {
      cart,
      shipping: {
        name: String(s.name).trim(),
        phone: String(s.phone).trim().replace(/\D/g, ''),
        email: customerEmail || undefined,
        country: String(s.country).trim(),
        province: String(s.province).trim(),
        address: String(s.address).trim(),
      },
      subtotal: discountedSubtotal,
      subtotalBeforeDiscount: promoRes.redeem ? lineSubtotal : undefined,
      promoCode: promoRes.redeem ? promoRes.code : undefined,
      promoPercent: promoRes.redeem ? promoRes.percent : undefined,
      shippingFee: shipFee,
      total: totalCheck,
      paymentMethod: 'whatsapp',
    };
    const userId = req.user?.id || null;

    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, user_id, items_json, subtotal, itbis, total, status, customer_name, customer_email, tracking_code, tracking_stage)
      VALUES (?, ?, ?, ?, 0, ?, 'pending_transfer', ?, ?, ?, 'received')
    `);
    const insertPromo = db.prepare(`
      INSERT INTO promo_redemptions (promo_code, phone_key, order_number) VALUES (?, ?, ?)
    `);

    const trackingCode = uniqueTrackingCode();

    const tx = db.transaction(() => {
      insertOrder.run(
        orderNum,
        userId,
        JSON.stringify(payload),
        discountedSubtotal,
        totalCheck,
        payload.shipping.name,
        customerEmail,
        trackingCode,
      );
      if (promoRes.redeem && promoRes.phoneKey) {
        insertPromo.run(promoRes.code, promoRes.phoneKey, orderNum);
      }
    });
    tx();

    const numItems = cart.reduce((s, i) => s + (Number(i.qty) || 1), 0);
    sendMetaPurchaseEvent({
      orderNumber: orderNum,
      total: totalCheck,
      numItems,
      email: customerEmail,
      phone: payload.shipping.phone,
      req,
    }).catch(() => {});

    const receiptEmail = customerEmail || (userId ? req.user?.email : null);
    sendOrderReceiptEmail({
      to: receiptEmail,
      order: {
        orderNumber: orderNum,
        trackingCode,
        name: payload.shipping.name,
        country: payload.shipping.country,
        province: payload.shipping.province,
        address: payload.shipping.address,
        method: 'Transferencia / WhatsApp',
        statusLabel: 'Pendiente de confirmación de pago',
        dateStr: new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' }),
        items: cart.map(i => ({ name: i.name, size: i.size || '', qty: Number(i.qty) || 1, price: Number(i.price) })),
        lineSubtotal,
        discountAmt: promoRes.redeem ? Math.round((lineSubtotal - discountedSubtotal) * 100) / 100 : 0,
        promoPct: promoRes.redeem ? promoRes.percent : 0,
        shippingFee: shipFee,
        total: totalCheck,
      },
    }).catch(() => {});

    res.json({
      ok: true,
      orderNumber: orderNum,
      trackingCode,
      trackingUrl: trackingUrlFromCode(req, trackingCode),
    });
  } catch (e) {
    console.error('whatsapp-submit:', e);
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Reintentá en un momento.' });
    }
    res.status(500).json({ error: 'Error al guardar el pedido.' });
  }
});

// ─── AZUL Payment Page ────────────────────────────────────────────────────────
const AZUL_ENV  = process.env.AZUL_ENV === 'production' ? 'production' : 'sandbox';
const AZUL_URL  = AZUL_ENV === 'production'
  ? 'https://pagos.azul.com.do/PaymentPage/Default.aspx'
  : 'https://pruebas.azul.com.do/PaymentPage/Default.aspx';

app.post('/api/azul/checkout', (req, res) => {
  const { AZUL_MERCHANT_ID, AZUL_MERCHANT_NAME, AZUL_MERCHANT_TYPE, AZUL_AUTH_KEY } = process.env;

  if (!AZUL_MERCHANT_ID || !AZUL_AUTH_KEY) {
    return res.status(503).json({ error: 'AZUL no está configurado. Configure las credenciales en las variables de entorno.' });
  }

  const { cart, total, shipping, promoCode } = req.body || {};
  if (!cart?.length || total == null || total === '') return res.status(400).json({ error: 'Carrito vacío.' });

  const stockAzul = validateCartStock(cart);
  if (!stockAzul.ok) return res.status(400).json({ error: stockAzul.error });

  const lineSubtotal = cart.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  const promoRes = applyPromoCalziani(cart, promoCode, shipping?.phone);
  if (!promoRes.ok) return res.status(400).json({ error: promoRes.error });

  const totalUSDCheck = Math.round((promoRes.discountedSubtotal + CHECKOUT_SHIPPING_USD) * 100) / 100;
  if (!Number.isFinite(Number(total)) || Math.abs(Number(total) - totalUSDCheck) > 0.02) {
    return res.status(400).json({ error: 'Total no coincide.' });
  }

  const dopRate    = Number(process.env.USD_RATE) || 59.48;
  const totalDOP   = Math.round(totalUSDCheck * dopRate * 100); // last 2 digits = cents, e.g. 5000 = RD$50.00
  const amountStr  = String(totalDOP);
  const itbisStr   = '000'; // No ITBIS

  const orderNum   = `CAL${Date.now().toString().slice(-10)}`;
  const baseUrl    = process.env.BASE_URL || 'http://localhost:3000';
  const approvedUrl = `${baseUrl}/payment/success?method=azul`;
  const declinedUrl = `${baseUrl}/payment/cancel?method=declined`;
  const cancelUrl   = `${baseUrl}/payment/cancel?method=cancelled`;

  const merchantId   = AZUL_MERCHANT_ID;
  const merchantName = AZUL_MERCHANT_NAME || 'Calziani';
  const merchantType = AZUL_MERCHANT_TYPE || 'Comercio electronico';
  const currencyCode = '$'; // DOP symbol for AZUL

  // SHA-512 AuthHash — exact order per AZUL docs
  const hashInput = [
    merchantId, merchantName, merchantType, currencyCode,
    orderNum, amountStr, itbisStr,
    approvedUrl, declinedUrl, cancelUrl, approvedUrl, // approvedUrl appears twice (ResponsePostUrl)
    '1', 'orderId', orderNum, '0',                    // UseCustomField1, Label, Value, UseCustomField2
    AZUL_AUTH_KEY,
  ].join('');

  const authHash = crypto.createHash('sha512').update(hashInput).digest('hex').toUpperCase();

  const itemsPayload = {
    cart,
    shipping,
    promoCode: promoRes.redeem ? promoRes.code : undefined,
    subtotalBeforeDiscount: promoRes.redeem ? lineSubtotal : undefined,
    promoPercent: promoRes.redeem ? promoRes.percent : undefined,
  };

  const insertAzulOrder = db.prepare(`
    INSERT INTO orders (order_number, user_id, items_json, subtotal, itbis, total, status, customer_name, customer_email, tracking_code, tracking_stage)
    VALUES (?, ?, ?, ?, ?, ?, 'pending_azul', ?, ?, ?, 'received')
  `);
  const insertPromoAzul = db.prepare(`
    INSERT INTO promo_redemptions (promo_code, phone_key, order_number) VALUES (?, ?, ?)
  `);

  const azulTrackingCode = uniqueTrackingCode();

  const azulEmail = isValidEmail(shipping?.email) ? String(shipping.email).trim() : null;

  try {
    const tx = db.transaction(() => {
      insertAzulOrder.run(
        orderNum,
        req.user?.id || null,
        JSON.stringify(itemsPayload),
        promoRes.discountedSubtotal,
        0,
        totalUSDCheck,
        shipping?.name || null,
        azulEmail,
        azulTrackingCode,
      );
      if (promoRes.redeem && promoRes.phoneKey) {
        insertPromoAzul.run(promoRes.code, promoRes.phoneKey, orderNum);
      }
    });
    tx();
  } catch (e) {
    console.error('AZUL DB save:', e.message);
    return res.status(500).json({ error: 'No se pudo crear el pedido.' });
  }

  const azulReceiptEmail = azulEmail || (req.user?.email || null);
  sendOrderReceiptEmail({
    to: azulReceiptEmail,
    order: {
      orderNumber: orderNum,
      trackingCode: azulTrackingCode,
      name: shipping?.name || '',
      country: shipping?.country || '',
      province: shipping?.province || '',
      address: shipping?.address || '',
      method: 'Tarjeta de crédito/débito (AZUL)',
      statusLabel: 'Pago en proceso',
      dateStr: new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' }),
      items: cart.map(i => ({ name: i.name, size: i.size || '', qty: Number(i.qty) || 1, price: Number(i.price) })),
      lineSubtotal,
      discountAmt: promoRes.redeem ? Math.round((lineSubtotal - promoRes.discountedSubtotal) * 100) / 100 : 0,
      promoPct: promoRes.redeem ? promoRes.percent : 0,
      shippingFee: CHECKOUT_SHIPPING_USD,
      total: totalUSDCheck,
    },
  }).catch(() => {});

  res.json({
    azulUrl: AZUL_URL,
    orderNumber: orderNum,
    trackingCode: azulTrackingCode,
    trackingUrl: trackingUrlFromCode(req, azulTrackingCode),
    fields: {
      MerchantId:        merchantId,
      MerchantName:      merchantName,
      MerchantType:      merchantType,
      CurrencyCode:      currencyCode,
      OrderNumber:       orderNum,
      Amount:            amountStr,
      itbis:             itbisStr,
      ApprovedUrl:       approvedUrl,
      DeclinedUrl:       declinedUrl,
      CancelUrl:         cancelUrl,
      ResponsePostUrl:   approvedUrl,
      UseCustomField1:   '1',
      CustomField1Label: 'orderId',
      CustomField1Value: orderNum,
      UseCustomField2:   '0',
      AuthHash:          authHash,
      ShowTransactionResult: '0',
    },
  });
});

// ─── Order tracking endpoints ──────────────────────────────────────────────────

// Admin: manually create an order
app.post('/api/admin/orders', requireAuth, (req, res) => {
  const {
    customer_name, customer_phone, country, province, address,
    items, shipping_fee, payment_method, tracking_stage, tracking_notes,
  } = req.body || {};

  if (!String(customer_name || '').trim()) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Agregá al menos un producto.' });
  }

  const cartLines = items
    .map(i => ({
      id:    i.id    ? String(i.id).trim()    : undefined,
      name:  String(i.name  || '').trim(),
      qty:   Math.max(1, Math.floor(Number(i.qty)  || 1)),
      price: Math.max(0, Number(i.price) || 0),
      size:  String(i.size  || '').trim(),
      cover: i.cover ? String(i.cover).trim() : undefined,
    }))
    .filter(i => i.name);

  if (!cartLines.length) {
    return res.status(400).json({ error: 'Todos los productos deben tener nombre.' });
  }

  const subtotal   = Math.round(cartLines.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  const shipFee    = Math.max(0, Number(shipping_fee) || 0);
  const total      = Math.round((subtotal + shipFee) * 100) / 100;
  const stage      = TRACKING_STAGES.includes(tracking_stage) ? tracking_stage : 'received';
  const payMethod  = String(payment_method || 'manual').trim();

  const orderNum   = `CAL-M${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const trackingCode = uniqueTrackingCode();

  const payload = {
    cart: cartLines,
    shipping: {
      name:     String(customer_name || '').trim(),
      phone:    String(customer_phone || '').trim(),
      country:  String(country  || '').trim(),
      province: String(province || '').trim(),
      address:  String(address  || '').trim(),
    },
    subtotal,
    shippingFee: shipFee,
    total,
    paymentMethod: payMethod,
  };

  try {
    db.prepare(`
      INSERT INTO orders
        (order_number, user_id, items_json, subtotal, itbis, total, status,
         customer_name, customer_email, tracking_code, tracking_stage, tracking_notes)
      VALUES (?, NULL, ?, ?, 0, ?, 'manual', ?, NULL, ?, ?, ?)
    `).run(
      orderNum,
      JSON.stringify(payload),
      subtotal,
      total,
      String(customer_name).trim(),
      trackingCode,
      stage,
      String(tracking_notes || '').trim(),
    );

    res.status(201).json({
      ok: true,
      order_number:  orderNum,
      tracking_code: trackingCode,
      tracking_url:  trackingUrlFromCode(req, trackingCode),
    });
  } catch (e) {
    console.error('manual-order:', e);
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Reintentá en un momento.' });
    }
    res.status(500).json({ error: 'Error al crear el pedido.' });
  }
});

// Admin: list orders (includes tracking fields)
app.get('/api/admin/orders', requireAuth, (req, res) => {
  const pageNum  = parseInt(req.query.page);
  const limitNum = parseInt(req.query.limit) || 10;
  const paginate = !isNaN(pageNum) && pageNum >= 1;

  const total  = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
  const offset = paginate ? (pageNum - 1) * limitNum : 0;
  const sqlLimit = paginate ? limitNum : 200;

  const orders = db.prepare(
    `SELECT id, order_number, customer_name, customer_email, subtotal, itbis, total,
            status, created_at, items_json, tracking_code, tracking_stage, tracking_notes
     FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(sqlLimit, offset);

  if (paginate) {
    res.json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } else {
    res.json(orders);
  }
});

// Admin: edit order (customer info + status; generates tracking code if missing)
app.put('/api/admin/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

  const { customer_name, customer_phone, country, province, address, status } = req.body || {};

  let payload = {};
  try { payload = JSON.parse(order.items_json || '{}'); } catch {}
  const prevShip = payload.shipping || {};

  payload.shipping = {
    name:     String(customer_name   ?? prevShip.name     ?? '').trim(),
    phone:    String(customer_phone  ?? prevShip.phone    ?? '').trim(),
    country:  String(country         ?? prevShip.country  ?? '').trim(),
    province: String(province        ?? prevShip.province ?? '').trim(),
    address:  String(address         ?? prevShip.address  ?? '').trim(),
  };

  const VALID_STATUSES = ['pending_transfer','pending_azul','pending_paypal','paid_paypal','paid','cancelled','manual'];
  const newStatus = VALID_STATUSES.includes(status) ? status : order.status;

  const newName = String(customer_name ?? '').trim() || order.customer_name;

  let trackingCode = order.tracking_code;
  if (!trackingCode) trackingCode = uniqueTrackingCode();

  db.prepare(`
    UPDATE orders SET customer_name = ?, status = ?, items_json = ?, tracking_code = ? WHERE id = ?
  `).run(newName, newStatus, JSON.stringify(payload), trackingCode, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({ ...updated, tracking_url: trackingUrlFromCode(req, trackingCode) });
});

// Admin: delete order
app.delete('/api/admin/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Pedido eliminado.' });
});

// Admin: update tracking code, stage + notes for an order
app.put('/api/admin/orders/:id/tracking', requireAuth, (req, res) => {
  const { tracking_stage, tracking_notes, tracking_code } = req.body || {};
  if (!TRACKING_STAGES.includes(tracking_stage)) {
    return res.status(400).json({ error: 'Etapa de tracking inválida.' });
  }
  const order = db.prepare('SELECT id, tracking_code FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

  // Accept a custom code or keep the existing one; generate if still missing
  let newCode = String(tracking_code || '').trim().toUpperCase() || order.tracking_code;
  if (!newCode) newCode = uniqueTrackingCode();

  // If a custom code is provided, verify uniqueness (unless it's the same order's code)
  if (newCode !== order.tracking_code) {
    const clash = db.prepare('SELECT id FROM orders WHERE tracking_code = ? AND id != ?').get(newCode, req.params.id);
    if (clash) return res.status(409).json({ error: 'Ese código ya está en uso por otro pedido.' });
  }

  db.prepare(
    `UPDATE orders SET tracking_code = ?, tracking_stage = ?, tracking_notes = ? WHERE id = ?`
  ).run(newCode, tracking_stage, String(tracking_notes || '').trim(), req.params.id);

  const updated = db.prepare(
    `SELECT id, order_number, tracking_code, tracking_stage, tracking_notes FROM orders WHERE id = ?`
  ).get(req.params.id);

  res.json({ ...updated, tracking_url: trackingUrlFromCode(req, newCode) });
});

// Public: look up order by tracking code (no auth required)
app.get('/api/tracking/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Código requerido.' });

  const order = db.prepare(
    `SELECT order_number, customer_name, total, status, created_at,
            tracking_code, tracking_stage, tracking_notes, items_json
     FROM orders WHERE tracking_code = ?`
  ).get(code);

  if (!order) return res.status(404).json({ error: 'Código no encontrado. Verificá que sea correcto.' });

  let cart = [];
  try { const d = JSON.parse(order.items_json || '{}'); cart = Array.isArray(d.cart) ? d.cart : []; } catch { /* */ }
  const numItems = cart.reduce((s, i) => s + Number(i.qty || 1), 0);

  const items = cart.map(i => ({
    name:  i.name  || '',
    size:  i.size  || '',
    qty:   Number(i.qty  || 1),
    cover: i.cover || '',
  }));

  res.json({
    order_number:    order.order_number,
    customer_name:   order.customer_name || '',
    total:           order.total,
    status:          order.status,
    created_at:      order.created_at,
    tracking_code:   order.tracking_code,
    tracking_stage:  order.tracking_stage || 'received',
    tracking_notes:  order.tracking_notes || '',
    num_items:       numItems,
    items,
  });
});

// ─── Sitemap.xml dinámico ─────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host  = req.get('host');
  const base  = host ? `${proto}://${host}` : (process.env.BASE_URL || 'https://calziani.com');

  const now = new Date().toISOString().slice(0, 10);

  const products = db.prepare(
    'SELECT id, updated_at, created_at FROM products ORDER BY id ASC'
  ).all();

  const staticUrls = [
    { loc: `${base}/`,        priority: '1.0', changefreq: 'daily' },
    { loc: `${base}/tracking`, priority: '0.4', changefreq: 'monthly' },
  ];

  const productUrls = products.map(p => {
    const lastmod = (p.updated_at || p.created_at || now).slice(0, 10);
    return { loc: `${base}/product/${p.id}`, priority: '0.8', changefreq: 'weekly', lastmod };
  });

  const allUrls = [...staticUrls, ...productUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ─── Global error handler (returns JSON, never HTML) ──────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

// ─── Fallback SPA routes ───────────────────────────────────────────────────────
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/tracking', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/favoritos',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'favoritos.html')));
app.get('/reset-password',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/politicas',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'politicas.html')));
app.get('/payment/success', (req, res) => res.sendFile(path.join(__dirname, 'public', 'payment-success.html')));
app.get('/payment/cancel',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'payment-cancel.html')));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Calziani corriendo en http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Usuario admin: admin | Contraseña: calziani2024`);
});
