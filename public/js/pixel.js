// ─── Calziani Meta Pixel Utilities ───────────────────────────────────────────
// Shared helper loaded before main.js / product.js on every page that needs
// custom events. Requires the fbq snippet to already be initialised in <head>.
(function () {
  'use strict';

  // ── SHA-256 via SubtleCrypto (HTTPS / localhost only) ─────────────────────
  async function sha256(raw) {
    if (!raw) return '';
    const str = String(raw).trim().toLowerCase();
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Hash all available user-data fields ───────────────────────────────────
  // Accepts: { email, phone, name, country, city }
  async function hashUserData(data) {
    if (!data) return {};
    const out = {};
    if (data.email) out.em = await sha256(data.email);
    if (data.phone) {
      const digits = String(data.phone).replace(/\D/g, '');
      if (digits) out.ph = await sha256(digits);
    }
    if (data.name) {
      const parts = String(data.name).trim().split(/\s+/);
      out.fn = await sha256(parts[0]);
      if (parts.length > 1) out.ln = await sha256(parts.slice(1).join(' '));
    }
    if (data.country) out.country = await sha256(data.country);
    if (data.city)    out.ct      = await sha256(data.city);
    return out;
  }

  // ── Fingerprint a cart array to deduplicate InitiateCheckout ─────────────
  function cartFingerprint(cart) {
    if (!cart || !cart.length) return '';
    return cart
      .map(i => `${i.id}__${i.size || ''}__${i.qty}`)
      .sort()
      .join('|');
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.CalzianiPixel = {

    sha256,
    hashUserData,

    // ViewContent — fire once per product page load
    trackViewContent(product) {
      if (typeof fbq === 'undefined') return;
      fbq('track', 'ViewContent', {
        content_name: String(product.name),
        content_ids:  [String(product.id)],
        value:        Number(product.price),
        currency:     'USD',
      });
    },

    // AddToCart — fire every time the user adds an item
    trackAddToCart(item) {
      if (typeof fbq === 'undefined') return;
      fbq('track', 'AddToCart', {
        content_name: String(item.name),
        content_ids:  [String(item.id)],
        value:        Number(item.price),
        currency:     'USD',
        num_items:    1,
      });
    },

    // InitiateCheckout — deduplicated per cart state via sessionStorage
    // userData = { name, phone, email, country } — all optional, hashed before send
    async trackInitiateCheckout(cart, total, userData) {
      if (typeof fbq === 'undefined') return;
      if (!cart || !cart.length) return;

      const fp = cartFingerprint(cart);
      if (sessionStorage.getItem('fbq_ic_fp') === fp) return;
      sessionStorage.setItem('fbq_ic_fp', fp);

      const num_items = cart.reduce((s, i) => s + i.qty, 0);
      const eventData = { value: Number(total), currency: 'USD', num_items };

      if (userData && (userData.email || userData.phone || userData.name)) {
        const hashed = await hashUserData(userData);
        fbq('track', 'InitiateCheckout', eventData, hashed);
      } else {
        fbq('track', 'InitiateCheckout', eventData);
      }
    },

    // Purchase — fire only on confirmed AZUL success page (once per session)
    // orderData = { total, numItems, orderId }
    // userData  = { name, phone, email, country } — all optional
    async trackPurchase(orderData, userData) {
      if (typeof fbq === 'undefined') return;

      const eventData = {
        value:     Number(orderData.total),
        currency:  'USD',
        num_items: Number(orderData.numItems),
      };
      if (orderData.orderId) eventData.order_id = String(orderData.orderId);

      if (userData && (userData.email || userData.phone || userData.name)) {
        const hashed = await hashUserData(userData);
        fbq('track', 'Purchase', eventData, hashed);
      } else {
        fbq('track', 'Purchase', eventData);
      }
    },
  };
})();
