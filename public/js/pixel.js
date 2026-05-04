// ─── Calziani Meta Pixel Utilities ───────────────────────────────────────────
// Cargado ANTES de main.js / product.js en cada página que necesite eventos.
// Requiere que el snippet fbq ya esté inicializado en el <head>.
(function () {
  'use strict';

  // ── SHA-256 via SubtleCrypto (solo HTTPS o localhost) ─────────────────────
  async function sha256(raw) {
    if (!raw) return '';
    const str = String(raw).trim().toLowerCase();
    try {
      const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(str)
      );
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      console.warn('[CalzianiPixel] sha256 falló (¿no es HTTPS?):', e.message);
      return '';
    }
  }

  // ── Hash de todos los campos de usuario disponibles ───────────────────────
  async function hashUserData(data) {
    if (!data) return {};
    const out = {};
    try {
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
    } catch (e) {
      console.warn('[CalzianiPixel] hashUserData error:', e.message);
    }
    return out;
  }

  // ── Huella del carrito para deduplicar InitiateCheckout ───────────────────
  function cartFingerprint(cart) {
    if (!cart || !cart.length) return '';
    return cart
      .map(i => `${i.id}__${i.size || ''}__${i.qty}`)
      .sort()
      .join('|');
  }

  // ── Dedup de AddToCart: evita doble disparo por doble-clic ────────────────
  let _lastAddToCartKey = '';
  let _lastAddToCartTs  = 0;
  const ADD_TO_CART_DEBOUNCE_MS = 800;

  function shouldFireAddToCart(itemId) {
    const key = String(itemId);
    const now = Date.now();
    if (key === _lastAddToCartKey && now - _lastAddToCartTs < ADD_TO_CART_DEBOUNCE_MS) {
      console.log('[CalzianiPixel] AddToCart ignorado (doble clic):', key);
      return false;
    }
    _lastAddToCartKey = key;
    _lastAddToCartTs  = now;
    return true;
  }

  // ── Verificación de fbq con log claro ─────────────────────────────────────
  function assertFbq(eventName) {
    if (typeof fbq === 'undefined') {
      console.warn(`[CalzianiPixel] ⚠ fbq NO está disponible — ${eventName} no se disparó.`);
      return false;
    }
    return true;
  }

  // ── API pública ───────────────────────────────────────────────────────────
  window.CalzianiPixel = {

    sha256,
    hashUserData,

    // ViewContent — una vez por carga de página de producto
    trackViewContent(product) {
      if (!assertFbq('ViewContent')) return;
      const params = {
        content_name: String(product.name),
        content_ids:  [String(product.id)],
        value:        Number(product.price),
        currency:     'USD',
      };
      console.log('[CalzianiPixel] ▶ ViewContent', params);
      try {
        fbq('track', 'ViewContent', params);
      } catch (e) {
        console.error('[CalzianiPixel] ViewContent error:', e);
      }
    },

    // AddToCart — con dedup de doble-clic
    trackAddToCart(item) {
      if (!assertFbq('AddToCart')) return;
      if (!shouldFireAddToCart(item.id)) return;
      const params = {
        content_name: String(item.name),
        content_ids:  [String(item.id)],
        value:        Number(item.price),
        currency:     'USD',
        num_items:    1,
      };
      console.log('[CalzianiPixel] ▶ AddToCart', params);
      try {
        fbq('track', 'AddToCart', params);
      } catch (e) {
        console.error('[CalzianiPixel] AddToCart error:', e);
      }
    },

    // InitiateCheckout — deduplicado por huella del carrito (sessionStorage)
    async trackInitiateCheckout(cart, total, userData) {
      if (!assertFbq('InitiateCheckout')) return;
      if (!cart || !cart.length) {
        console.log('[CalzianiPixel] InitiateCheckout omitido — carrito vacío');
        return;
      }

      const fp = cartFingerprint(cart);
      const stored = sessionStorage.getItem('fbq_ic_fp');
      if (stored === fp) {
        console.log('[CalzianiPixel] InitiateCheckout omitido — mismo carrito ya enviado');
        return;
      }
      sessionStorage.setItem('fbq_ic_fp', fp);

      const num_items = cart.reduce((s, i) => s + i.qty, 0);
      const eventData = { value: Number(total), currency: 'USD', num_items };

      console.log('[CalzianiPixel] ▶ InitiateCheckout', eventData, userData || '(sin user data)');
      try {
        if (userData && (userData.email || userData.phone || userData.name)) {
          const hashed = await hashUserData(userData);
          console.log('[CalzianiPixel]   user data hasheada:', Object.keys(hashed));
          fbq('track', 'InitiateCheckout', eventData, hashed);
        } else {
          fbq('track', 'InitiateCheckout', eventData);
        }
      } catch (e) {
        console.error('[CalzianiPixel] InitiateCheckout error:', e);
      }
    },

    // Purchase — solo en la página de éxito de AZUL, una vez por sesión
    async trackPurchase(orderData, userData) {
      if (!assertFbq('Purchase')) return;

      const eventData = {
        value:     Number(orderData.total),
        currency:  'USD',
        num_items: Number(orderData.numItems),
      };
      if (orderData.orderId) eventData.order_id = String(orderData.orderId);

      console.log('[CalzianiPixel] ▶ Purchase', eventData, userData || '(sin user data)');
      try {
        if (userData && (userData.email || userData.phone || userData.name)) {
          const hashed = await hashUserData(userData);
          console.log('[CalzianiPixel]   user data hasheada:', Object.keys(hashed));
          fbq('track', 'Purchase', eventData, hashed);
        } else {
          fbq('track', 'Purchase', eventData);
        }
      } catch (e) {
        console.error('[CalzianiPixel] Purchase error:', e);
      }
    },
  };

  // ── Log de inicio para confirmar que el script cargó ─────────────────────
  const fbqStatus = typeof fbq !== 'undefined' ? '✓ fbq disponible' : '⚠ fbq AÚN NO disponible (puede cargarse después)';
  console.log(`[CalzianiPixel] ✅ pixel.js cargado — ${fbqStatus}`);
})();
