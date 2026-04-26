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
if (!require('fs').existsSync(UPLOAD_DIR)) require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });

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

// Fetch ordered images for a product
function getProductImages(productId) {
  return db.prepare(
    'SELECT id, filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC'
  ).all(productId);
}

function attachImages(product) {
  const imgs = getProductImages(product.id);
  return {
    ...product,
    sizes: JSON.parse(product.sizes || '[]'),
    images: imgs.map(i => ({ id: i.id, filename: i.filename })),
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

app.get('/api/products', (req, res) => {
  const { category, search, size } = req.query;
  let query = 'SELECT * FROM products';
  const params = [];
  const conditions = [];

  if (category && category !== 'all') { conditions.push('category = ?'); params.push(category); }
  if (search && search.trim()) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';

  try {
    let products = db.prepare(query).all(...params);

    if (size && size !== 'all') {
      products = products.filter(p => {
        try { return JSON.parse(p.sizes || '[]').includes(size); } catch { return false; }
      });
    }

    // Attach first image only (for card display performance)
    products = products.map(p => {
      const firstImg = db.prepare(
        'SELECT filename FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC LIMIT 1'
      ).get(p.id);
      return {
        ...p,
        sizes: JSON.parse(p.sizes || '[]'),
        cover: firstImg ? firstImg.filename : null,
      };
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(attachImages(product));
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
  const { name, description, price, category, stock, sizes, shipping_days, compare_price } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'El precio debe ser un número válido' });
  if (!['calzado', 'ropa', 'accesorio'].includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  let parsedSizes;
  try { parsedSizes = JSON.parse(sizes || '[]'); } catch { parsedSizes = []; }
  const compPrice = compare_price && !isNaN(Number(compare_price)) && Number(compare_price) > 0 ? Number(compare_price) : null;
  const shipDays = shipping_days && String(shipping_days).trim() ? String(shipping_days).trim() : null;

  try {
    const result = db.prepare(
      'INSERT INTO products (name, description, price, category, stock, sizes, shipping_days, compare_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name.trim(), (description || '').trim(), Number(price),
      category, Number(stock) || 0,
      JSON.stringify(Array.isArray(parsedSizes) ? parsedSizes : []),
      shipDays, compPrice
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

  const { name, description, price, category, stock, sizes, shipping_days, compare_price, remove_image_ids } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'El precio debe ser un número válido' });
  if (!['calzado', 'ropa', 'accesorio'].includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  let parsedSizes;
  try { parsedSizes = JSON.parse(sizes || '[]'); } catch { parsedSizes = []; }
  const compPrice = compare_price && !isNaN(Number(compare_price)) && Number(compare_price) > 0 ? Number(compare_price) : null;
  const shipDays = shipping_days && String(shipping_days).trim() ? String(shipping_days).trim() : null;

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
       shipping_days = ?, compare_price = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      name.trim(), (description || '').trim(), Number(price),
      category, Number(stock) || 0,
      JSON.stringify(Array.isArray(parsedSizes) ? parsedSizes : []),
      shipDays, compPrice, req.params.id
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

// ─── Global error handler (returns JSON, never HTML) ──────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

// ─── Fallback SPA routes ───────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Calziani corriendo en http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Usuario admin: admin | Contraseña: calziani2024`);
});
