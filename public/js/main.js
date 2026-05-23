(() => {
  const grid           = document.getElementById('productGrid');
  const sectionTitle   = document.getElementById('sectionTitle');
  const productCount   = document.getElementById('productCount');
  const searchInput    = document.getElementById('searchInput');
  const navBtns        = document.querySelectorAll('.nav-btn');
  const sizeFilterBar  = document.getElementById('sizeFilterBar');
  const sizeFilterBtns = document.getElementById('sizeFilterBtns');
  const brandFilterBar = document.getElementById('brandFilterBar');
  const brandFilterBtns= document.getElementById('brandFilterBtns');

  let currentCategory    = 'all';
  let currentSize        = 'all';
  let currentBrand       = 'all';
  let searchTimer        = null;
  let _bestAvailablePromo = null; // best active promo from server (for card badges)

  // ─── Translations ─────────────────────────────────────────────────────────────
  const T = {
    es: {
      announcement:       'ENVÍO MUNDIAL GRATUITO EN PEDIDOS +$150',
      cat_all:            'Todo',
      cat_calzado:        'Calzado',
      cat_ropa:           'Ropa',
      cat_accesorio:      'Accesorios',
      search_placeholder: 'Buscar...',
      sign_in:            'Iniciar sesión',
      hero_eyebrow:       'NUEVA COLECCIÓN',
      hero_sub:           'LUXURY IN EACH STEP.',
      hero_cta:           'Explorar colección',
      sale_title:         'OFERTAS DE TEMPORADA',
      sale_sub:           'Aprovecha los mejores precios en productos seleccionados',
      sale_cta:           'Ver ofertas',
      sale_products_title:'— OFERTAS —',
      all_products:       'Todos los productos',
      size_label:         'Talle',
      loading:            'Cargando...',
      footer_copy:        '© 2026 Todos los derechos reservados.',
      available:          'Disponible',
      stock_low_hint:     'Quedan pocas unidades',
      out_of_stock:       'Sin stock',
      add_to_cart:        'Agregar',
      cat_label_calzado:  'Calzado',
      cat_label_ropa:     'Ropa',
      cat_label_accesorio:'Accesorio',
      title_all:          'Todos los productos',
      title_calzado:      'Calzado',
      title_ropa:         'Ropa',
      title_accesorio:    'Accesorios',
      terms_checkbox:     'Acepto los términos y condiciones de Calziani.',
      terms_read:         'Ver términos completos',
      terms_err:          'Debés aceptar los términos para continuar.',
      terms_modal_title:  'Términos y condiciones',
      promo_label:        'Código de descuento',
      promo_apply:        'Aplicar',
      promo_remove:       'Quitar código',
      promo_discount_label: 'Descuento (−20%)',
      size_pick_title:    'Elegí talle',
      size_pick_sub:      'Tocá un talle para agregarlo al carrito.',
    },
    en: {
      announcement:       'FREE WORLDWIDE SHIPPING ON ORDERS +$150',
      cat_all:            'All',
      cat_calzado:        'Footwear',
      cat_ropa:           'Clothing',
      cat_accesorio:      'Accessories',
      search_placeholder: 'Search...',
      sign_in:            'Sign in',
      hero_eyebrow:       'NEW COLLECTION',
      hero_sub:           'LUXURY IN EACH STEP.',
      hero_cta:           'Shop collection',
      sale_title:         'SEASONAL SALE',
      sale_sub:           'Get the best prices on selected products',
      sale_cta:           'View sale',
      sale_products_title:'— SALE —',
      all_products:       'All products',
      size_label:         'Size',
      loading:            'Loading...',
      footer_copy:        '© 2026 All rights reserved.',
      available:          'Available',
      stock_low_hint:     'Few units left',
      out_of_stock:       'Out of stock',
      add_to_cart:        'Add',
      cat_label_calzado:  'Footwear',
      cat_label_ropa:     'Clothing',
      cat_label_accesorio:'Accessory',
      title_all:          'All products',
      title_calzado:      'Footwear',
      title_ropa:         'Clothing',
      title_accesorio:    'Accessories',
      terms_checkbox:     'I accept Calziani\'s terms and conditions.',
      terms_read:         'Read full terms',
      terms_err:          'You must accept the terms to continue.',
      terms_modal_title:  'Terms and conditions',
      promo_label:        'Discount code',
      promo_apply:        'Apply',
      promo_remove:       'Remove code',
      promo_discount_label: 'Discount (−20%)',
      size_pick_title:    'Choose size',
      size_pick_sub:      'Tap a size to add to cart.',
    },
  };

  const TERMS_BODY_HTML = {
    es: `
        <p class="terms-modal__lead">Al comprar en Calziani aceptás las siguientes condiciones:</p>
        <ol class="terms-modal__list">
          <li><strong>Productos y precios.</strong> Las fotos y descripciones son orientativas. Los precios se muestran en USD con referencia en DOP; pueden corregirse errores evidentes antes de confirmar el pedido.</li>
          <li><strong>Pedidos.</strong> La compra queda sujeta a disponibilidad de stock y a la verificación del pago (transferencia u otro medio indicado).</li>
          <li><strong>Envío.</strong> Los plazos son estimados y pueden variar por destino o causas ajenas a Calziani. El costo de envío es el indicado al momento del checkout.</li>
          <li><strong>Devoluciones y reembolsos.</strong> Solo habrá reembolso o cambio por <strong>falla o defecto del producto</strong> (error de fábrica o envío incorrecto/dañado), previa revisión por Calziani. No proceden devoluciones por arrepentimiento, talla elegida incorrectamente o uso del artículo. Plazo para reclamos: <strong>7 días corridos</strong> desde la recepción, producto sin uso y con evidencia (fotos).</li>
          <li><strong>Privacidad.</strong> Tus datos de envío y contacto se usan solo para gestionar el pedido y comunicarnos contigo.</li>
          <li><strong>Legislación.</strong> Rigen las leyes de la República Dominicana.</li>
        </ol>
        <p class="terms-modal__foot">Si tenés dudas, escribinos por WhatsApp o Instagram antes de comprar.</p>`,
    en: `
        <p class="terms-modal__lead">By purchasing from Calziani you agree to the following:</p>
        <ol class="terms-modal__list">
          <li><strong>Products and pricing.</strong> Photos and descriptions are indicative. Prices are shown in USD with a DOP reference; obvious errors may be corrected before the order is confirmed.</li>
          <li><strong>Orders.</strong> Your purchase is subject to stock availability and payment verification (bank transfer or other method shown at checkout).</li>
          <li><strong>Shipping.</strong> Delivery times are estimates and may vary by destination or events outside Calziani’s control. Shipping cost is as stated at checkout.</li>
          <li><strong>Returns and refunds.</strong> Refunds or exchanges apply <strong>only for product failure or defect</strong> (manufacturing fault or wrong/damaged shipment), after review by Calziani. No refunds for change of mind, wrong size chosen by the customer, or used items. Claims: <strong>7 calendar days</strong> from receipt, unworn item with proof (photos).</li>
          <li><strong>Privacy.</strong> Shipping and contact details are used only to fulfil your order and contact you about it.</li>
          <li><strong>Governing law.</strong> The laws of the Dominican Republic apply.</li>
        </ol>
        <p class="terms-modal__foot">If you have questions, contact us on WhatsApp or Instagram before buying.</p>`,
  };

  function applyTermsModalBody() {
    const el = document.getElementById('termsModalBody');
    if (!el) return;
    el.innerHTML = TERMS_BODY_HTML[activeLang] || TERMS_BODY_HTML.es;
  }

  let activeLang = localStorage.getItem('calziani_lang') || 'es';

  function t(key) {
    if (T[activeLang] && Object.prototype.hasOwnProperty.call(T[activeLang], key)) return T[activeLang][key];
    if (Object.prototype.hasOwnProperty.call(T.es, key)) return T.es[key];
    return key;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.documentElement.lang = activeLang;
    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = activeLang.toUpperCase();
    // Update section title based on current category
    if (sectionTitle) sectionTitle.textContent = t(`title_${currentCategory}`);
    applyTermsModalBody();
  }

  function initLangBtn() {
    const btn = document.getElementById('langBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeLang = activeLang === 'es' ? 'en' : 'es';
      localStorage.setItem('calziani_lang', activeLang);
      applyTranslations();
      renderProducts(lastProducts);
    });
  }

  const CATEGORY_LABELS = {
    get calzado()   { return t('cat_label_calzado'); },
    get ropa()      { return t('cat_label_ropa'); },
    get accesorio() { return t('cat_label_accesorio'); },
  };
  const TITLE_MAP = {
    get all()       { return t('title_all'); },
    get calzado()   { return t('title_calzado'); },
    get ropa()      { return t('title_ropa'); },
    get accesorio() { return t('title_accesorio'); },
  };
  const SIZES_BY_CATEGORY = {
    calzado:   ['35','36','37','38','39','40','41','42','43','44','45'],
    ropa:      ['XS','S','M','L','XL','XXL'],
    accesorio: ['Única talla'],
  };

  // ─── Currency ─────────────────────────────────────────────────────────────────
  let currencyRates = { USD: 1, EUR: 0.92, DOP: 59.48 };
  let activeCurrency = localStorage.getItem('calziani_currency') || 'USD';

  const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', DOP: 'RD$' };
  const CURRENCY_LOCALES  = { USD: 'en-US', EUR: 'de-DE', DOP: 'es-DO' };
  const CURRENCY_DECIMALS = { USD: 2, EUR: 2, DOP: 0 };

  function formatPrice(priceUSD) {
    const converted = priceUSD * (currencyRates[activeCurrency] || 1);
    const sym = CURRENCY_SYMBOLS[activeCurrency];
    const loc = CURRENCY_LOCALES[activeCurrency];
    const dec = CURRENCY_DECIMALS[activeCurrency];
    return sym + new Intl.NumberFormat(loc, { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(converted);
  }

  /** USD + DOP for checkout / cart (prices are stored in USD) */
  function formatUsdCheckout(priceUSD) {
    return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(priceUSD) + ' USD';
  }
  function formatDopCheckout(priceUSD) {
    const dop = priceUSD * (currencyRates.DOP || 59.48);
    return 'RD$ ' + new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(dop));
  }

  async function loadCurrencyRates() {
    try {
      const data = await (await fetch('/api/currency-rates')).json();
      currencyRates = { ...currencyRates, ...data };
    } catch { /* use defaults */ }
  }

  function initCurrencySelect() {
    const sel = document.getElementById('currencySelect');
    if (!sel) return;
    sel.value = activeCurrency;
    sel.addEventListener('change', () => {
      activeCurrency = sel.value;
      localStorage.setItem('calziani_currency', activeCurrency);
      updateCartUI();
      renderProducts(lastProducts);
    });
  }

  function stockLabel(stock) {
    if (stock === 0) return { text: t('out_of_stock'), cls: 'out' };
    if (stock > 0 && stock < 5)  return { text: t('stock_low_hint'), cls: 'low' };
    return { text: t('available'), cls: '' };
  }

  function aggregateStock(p) {
    if (p.sizes?.length && p.sizes_stock && typeof p.sizes_stock === 'object') {
      return p.sizes.reduce((sum, sz) => sum + (Number(p.sizes_stock[sz]) || 0), 0);
    }
    return Number(p.stock) || 0;
  }

  function productHasPickableStock(p) {
    return aggregateStock(p) > 0;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Favorites (localStorage) ─────────────────────────────────────────────────
  function getFavs() {
    try { return JSON.parse(localStorage.getItem('calziani_favs') || '[]'); } catch { return []; }
  }
  function saveFavs(favs) { localStorage.setItem('calziani_favs', JSON.stringify(favs)); }
  function isFav(id) { return getFavs().includes(Number(id)); }
  function toggleFav(id) {
    id = Number(id);
    const favs = getFavs();
    const idx  = favs.indexOf(id);
    if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
    saveFavs(favs);
    return idx < 0;
  }

  // ─── Cart (localStorage) ──────────────────────────────────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('calziani_cart') || '[]'); } catch { return []; }
  }
  function saveCart(cart) { localStorage.setItem('calziani_cart', JSON.stringify(cart)); }

  function addToCart(product) {
    const cart = getCart();
    const key  = `${product.id}__${product.size || ''}`;
    const existing = cart.find(i => `${i.id}__${i.size || ''}` === key);
    const maxQty = product.maxQty ?? Infinity;
    if (existing) {
      existing.qty = Math.min(maxQty, existing.qty + 1);
      if (product.maxQty !== undefined) existing.maxQty = product.maxQty;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    saveCart(cart);
    updateCartUI();
    openCart();
    console.log('[main.js] addToCart llamado →', product.name);
    if (window.CalzianiPixel) {
      window.CalzianiPixel.trackAddToCart({
        id:    product.id,
        name:  product.name,
        price: product.price,
      });
    } else {
      console.warn('[main.js] CalzianiPixel no disponible — AddToCart no se disparó');
    }
  }

  const sizePickModal    = document.getElementById('sizePickModal');
  const sizePickBackdrop = document.getElementById('sizePickBackdrop');
  const sizePickClose    = document.getElementById('sizePickClose');
  const sizePickName     = document.getElementById('sizePickProductName');
  const sizePickList     = document.getElementById('sizePickList');
  const sizePickErr      = document.getElementById('sizePickErr');

  function closeSizePickModal() {
    sizePickModal?.classList.remove('open');
    sizePickModal?.setAttribute('aria-hidden', 'true');
    if (sizePickList) sizePickList.innerHTML = '';
    sizePickErr?.classList.add('hidden');
  }

  function openSizePickModal(product) {
    if (!sizePickModal || !sizePickList || !sizePickName) return;
    sizePickName.textContent = product.name;
    sizePickErr?.classList.add('hidden');
    const ss = product.sizes_stock || {};
    sizePickList.innerHTML = '';
    (product.sizes || []).forEach(sz => {
      const q = Number(ss[sz]) || 0;
      const disabled = q <= 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `size-pick-btn${disabled ? ' disabled' : ''}`;
      b.disabled = disabled;
      b.textContent = disabled ? `${sz} (${t('out_of_stock')})` : String(sz);
      if (!disabled) {
        b.addEventListener('click', () => {
          const maxQty = Number((product.sizes_stock || {})[sz]) || 0;
          addToCart({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            cover: product.cover || '',
            size: sz,
            maxQty: maxQty > 0 ? maxQty : undefined,
          });
          closeSizePickModal();
        });
      }
      sizePickList.appendChild(b);
    });
    sizePickModal.classList.add('open');
    sizePickModal.setAttribute('aria-hidden', 'false');
  }

  function beginAddToCart(product) {
    if (!product || !productHasPickableStock(product)) return;
    if (product.sizes?.length) {
      openSizePickModal(product);
      return;
    }
    const maxQty = Number(product.stock) > 0 ? Number(product.stock) : undefined;
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      cover: product.cover || '',
      size: '',
      maxQty,
    });
  }

  sizePickBackdrop?.addEventListener('click', closeSizePickModal);
  sizePickClose?.addEventListener('click', closeSizePickModal);

  function removeFromCart(id, size) {
    const key  = `${id}__${size || ''}`;
    saveCart(getCart().filter(i => `${i.id}__${i.size || ''}` !== key));
    updateCartUI();
  }

  function changeQty(id, size, delta) {
    const key  = `${id}__${size || ''}`;
    const cart = getCart();
    const item = cart.find(i => `${i.id}__${i.size || ''}` === key);
    if (!item) return;
    const maxQty = item.maxQty ?? Infinity;
    item.qty = Math.min(maxQty, Math.max(1, item.qty + delta));
    saveCart(cart);
    updateCartUI();
  }

  function cartCount() { return getCart().reduce((s, i) => s + i.qty, 0); }

  // ─── Cart UI ──────────────────────────────────────────────────────────────────
  const cartDrawer  = document.getElementById('cartDrawer');
  const cartBackdrop= document.getElementById('cartBackdrop');
  const cartClose   = document.getElementById('cartClose');
  const cartBtn     = document.getElementById('cartBtn');
  const cartBadge   = document.getElementById('cartBadge');
  const cartItems   = document.getElementById('cartItems');
  const cartEmpty   = document.getElementById('cartEmpty');
  const cartFoot    = document.getElementById('cartFoot');
  const cartSubtotalUsd = document.getElementById('cartSubtotalUsd');
  const cartSubtotalDop = document.getElementById('cartSubtotalDop');
  const cartShippingUsd = document.getElementById('cartShippingUsd');
  const cartShippingDop = document.getElementById('cartShippingDop');
  const cartTotalUsd    = document.getElementById('cartTotalUsd');
  const cartTotalDop     = document.getElementById('cartTotalDop');
  const cartDiscountRow = document.getElementById('cartDiscountRow');
  const cartDiscountUsd = document.getElementById('cartDiscountUsd');
  const cartDiscountDop = document.getElementById('cartDiscountDop');
  const promoCodeInput = document.getElementById('promoCodeInput');
  const promoApplyBtn = document.getElementById('promoApplyBtn');
  const promoClearBtn = document.getElementById('promoClearBtn');
  const promoMsg = document.getElementById('promoMsg');
  const checkoutBtn   = document.getElementById('checkoutBtn');

  const SHIPPING_USD    = 5;
  const LS_PROMO_DATA   = 'calziani_promo_data'; // stores { code, percent, excludedProductIds }
  // Clear legacy key from old hardcoded promo system
  try { localStorage.removeItem('calziani_promo_calziani'); } catch (_) {}

  function activePromoData() {
    try {
      const raw = localStorage.getItem(LS_PROMO_DATA);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function activePromoCode()  { return activePromoData()?.code  || null; }
  function activePromoPct()   { return activePromoData()?.percent || 0; }
  function promoCalzianiActive() { return !!activePromoData(); }

  function setPromoData(data) {
    try {
      if (data) localStorage.setItem(LS_PROMO_DATA, JSON.stringify(data));
      else localStorage.removeItem(LS_PROMO_DATA);
    } catch (_) {}
  }
  function setPromoCalziani(on, code) {
    if (!on) setPromoData(null);
    // when enabling, full data is set by applyPromoFromInput after API call
  }

  async function applyPromoFromInput() {
    const v = (promoCodeInput?.value || '').trim().toUpperCase();
    if (!v) {
      setPromoData(null);
      promoClearBtn?.classList.add('hidden');
      promoMsg?.classList.add('hidden');
      updateCartUI();
      return;
    }

    if (promoApplyBtn) { promoApplyBtn.disabled = true; promoApplyBtn.textContent = '...'; }
    try {
      const res  = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoData(null);
        if (promoMsg) {
          promoMsg.textContent = data.error || (activeLang === 'en' ? 'Invalid code.' : 'Código no válido.');
          promoMsg.classList.remove('hidden');
        }
        promoClearBtn?.classList.add('hidden');
      } else {
        setPromoData({ code: data.code, percent: data.percent, excludedProductIds: data.excludedProductIds || [] });
        promoMsg?.classList.add('hidden');
        promoClearBtn?.classList.remove('hidden');
        if (promoCodeInput) promoCodeInput.value = '';
      }
    } catch {
      if (promoMsg) {
        promoMsg.textContent = activeLang === 'en' ? 'Connection error.' : 'Error de conexión.';
        promoMsg.classList.remove('hidden');
      }
    } finally {
      if (promoApplyBtn) { promoApplyBtn.disabled = false; promoApplyBtn.textContent = activeLang === 'en' ? 'Apply' : 'Aplicar'; }
    }
    updateCartUI();
  }

  function initPromoCart() {
    promoApplyBtn?.addEventListener('click', applyPromoFromInput);
    promoClearBtn?.addEventListener('click', () => {
      setPromoData(null);
      if (promoCodeInput) promoCodeInput.value = '';
      promoMsg?.classList.add('hidden');
      promoClearBtn?.classList.add('hidden');
      updateCartUI();
    });
    promoCodeInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPromoFromInput();
      }
    });
  }

  function openCart()  { cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
  function closeCart() { cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }

  function fireInitiateCheckout() {
    const cart = getCart();
    if (!cart.length) {
      console.log('[main.js] fireInitiateCheckout: carrito vacío, ignorado');
      return;
    }
    const { total } = cartTotals();
    console.log('[main.js] fireInitiateCheckout → total:', total, '| items:', cart.length);
    if (window.CalzianiPixel) {
      window.CalzianiPixel.trackInitiateCheckout(cart, total);
    } else {
      console.warn('[main.js] CalzianiPixel no disponible — InitiateCheckout no se disparó');
    }
  }

  cartBtn?.addEventListener('click', () => { openCart(); fireInitiateCheckout(); });
  cartClose?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const termsModal = document.getElementById('termsModal');
    if (termsModal?.classList.contains('open')) {
      termsModal.classList.remove('open');
      termsModal.setAttribute('aria-hidden', 'true');
      return;
    }
    if (sizePickModal?.classList.contains('open')) {
      closeSizePickModal();
      return;
    }
    if (cartDrawer?.classList.contains('open')) closeCart();
  });

  function updateCartUI() {
    const cart  = getCart();
    const count = cartCount();

    // Badge
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.classList.toggle('hidden', count === 0);
    }

    // Empty state
    if (!cart.length) {
      cartEmpty.classList.remove('hidden');
      cartItems.classList.add('hidden');
      cartFoot.classList.add('hidden');
      const at = document.getElementById('acceptTerms');
      if (at) at.checked = false;
      updateCheckoutTermsGate();
      return;
    }
    cartEmpty.classList.add('hidden');
    cartItems.classList.remove('hidden');
    cartFoot.classList.remove('hidden');

    // Items
    const _promoData    = activePromoData();
    const _excludedIds  = _promoData ? (_promoData.excludedProductIds || []).map(Number) : [];
    cartItems.innerHTML = cart.map(item => {
      const excluded = _promoData && _excludedIds.includes(Number(item.id));
      return `
      <li class="cart-item">
        <div class="cart-item__img">
          ${item.cover
            ? `<img src="/img/products/${escHtml(item.cover)}" alt="${escHtml(item.name)}" />`
            : `<div class="cart-item__img-empty">C</div>`}
        </div>
        <div class="cart-item__info">
          <p class="cart-item__name">${escHtml(item.name)}</p>
          ${item.size ? `<p class="cart-item__size">Talle: ${escHtml(item.size)}</p>` : ''}
          ${excluded ? `<p class="cart-item__promo-excluded">El código ${escHtml(_promoData.code)} no aplica a este producto</p>` : ''}
          <div class="cart-item__qty">
            <button class="qty-btn" data-id="${item.id}" data-size="${item.size||''}" data-delta="-1">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-size="${item.size||''}" data-delta="1" ${item.maxQty !== undefined && item.qty >= item.maxQty ? 'disabled style="opacity:.35;cursor:default"' : ''}>+</button>
          </div>
        </div>
        <div class="cart-item__right">
          <div class="cart-item__price-block">
            <span class="cart-item__price">${formatUsdCheckout(item.price * item.qty)}</span>
            <span class="cart-item__price-dop">${formatDopCheckout(item.price * item.qty)}</span>
          </div>
          <button class="cart-item__remove" data-id="${item.id}" data-size="${item.size||''}" aria-label="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </li>`;
    }).join('');

    // Totals (USD + DOP for transfer / local customers)
    const ct = cartTotals();
    if (cartSubtotalUsd) cartSubtotalUsd.textContent = formatUsdCheckout(ct.lineSubtotal);
    if (cartSubtotalDop) cartSubtotalDop.textContent = formatDopCheckout(ct.lineSubtotal);
    if (cartDiscountRow) {
      cartDiscountRow.classList.toggle('hidden', !ct.promoOn);
      if (ct.promoOn && cartDiscountUsd && cartDiscountDop) {
        cartDiscountUsd.textContent = `− ${formatUsdCheckout(ct.discountAmt)}`;
        cartDiscountDop.textContent = `− ${formatDopCheckout(ct.discountAmt)}`;
      }
    }
    if (promoClearBtn) promoClearBtn.classList.toggle('hidden', !promoCalzianiActive());
    if (cartShippingUsd) cartShippingUsd.textContent = formatUsdCheckout(SHIPPING_USD);
    if (cartShippingDop) cartShippingDop.textContent = formatDopCheckout(SHIPPING_USD);
    if (cartTotalUsd) cartTotalUsd.textContent = formatUsdCheckout(ct.total);
    if (cartTotalDop) cartTotalDop.textContent = formatDopCheckout(ct.total);
    updateCheckoutTermsGate();

    // Qty buttons
    cartItems.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => changeQty(btn.dataset.id, btn.dataset.size, Number(btn.dataset.delta)));
    });
    cartItems.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id, btn.dataset.size));
    });

  }

  // ─── Payment methods ──────────────────────────────────────────────────────────
  let payConfig   = {};
  let activeMethod = 'transfer';

  const payMethodTabs      = document.querySelectorAll('.pay-method-tab');
  const payPanelCard       = document.getElementById('payPanelCard');
  const payPanelTransfer   = document.getElementById('payPanelTransfer');
  const transferInfo       = document.getElementById('transferInfo');
  const btnWhatsapp        = document.getElementById('btnWhatsapp');
  const btnAzulPay         = document.getElementById('btnAzulPay');
  const azulNote           = document.getElementById('azulNote');

  payMethodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      payMethodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeMethod = tab.dataset.method;
      payPanelCard?.classList.toggle('active', activeMethod === 'card');
      payPanelTransfer?.classList.toggle('active', activeMethod === 'transfer');
    });
  });

  async function loadPaymentConfig() {
    try {
      const res = await fetch('/api/payment-config');
      payConfig = await res.json();
      renderTransferInfo();
      const { total } = cartTotals();
      const dopRate   = currencyRates.DOP || 59.48;
      if (azulNote) azulNote.textContent = `Total: RD$${(total * dopRate).toFixed(0)} (USD $${total.toFixed(2)})`;
    } catch { /* ignore */ }
  }

  function renderTransferInfo() {
    if (!transferInfo) return;
    const c = payConfig;
    transferInfo.innerHTML = `
      <div class="transfer-row"><span>Banco</span><strong>${c.bankName || '—'}</strong></div>
      <div class="transfer-row"><span>Cuenta</span><strong>${c.bankAccount || '—'}</strong></div>
      <div class="transfer-row"><span>Titular</span><strong>${c.bankHolder || '—'}</strong></div>
      <div class="transfer-row"><span>Tipo</span><strong>${c.bankType || '—'}</strong></div>
      <p class="transfer-note">Enviá el comprobante por WhatsApp y confirmamos tu pedido.</p>`;
  }

  function getShippingInfo() {
    return {
      name:     (document.getElementById('shipName')?.value     || '').trim(),
      phone:    (document.getElementById('shipPhone')?.value    || '').trim(),
      country:  (document.getElementById('shipCountry')?.value  || '').trim(),
      province: (document.getElementById('shipProvince')?.value || '').trim(),
      address:  (document.getElementById('shipAddress')?.value  || '').trim(),
    };
  }

  function validateShipping() {
    const s = getShippingInfo();
    const ok = s.name && s.phone && s.country && s.province && s.address;
    const errEl = document.getElementById('shippingErr');
    if (errEl) errEl.classList.toggle('hidden', ok);
    return ok;
  }

  function validateTerms() {
    const ok = !!document.getElementById('acceptTerms')?.checked;
    document.getElementById('termsErr')?.classList.toggle('hidden', ok);
    return ok;
  }

  function updateCheckoutTermsGate() {
    const ok = !!document.getElementById('acceptTerms')?.checked;
    ['btnWhatsapp', 'btnAzulPay'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = !ok;
      btn.style.opacity = ok ? '' : '0.45';
      btn.style.cursor = ok ? '' : 'not-allowed';
    });
  }

  function initTermsCheckout() {
    const modal = document.getElementById('termsModal');
    const accept = document.getElementById('acceptTerms');
    const openBtn = document.getElementById('openTermsModal');
    const backdrop = document.getElementById('termsBackdrop');
    const closeBtn = document.getElementById('termsModalClose');

    function closeTermsModal() {
      modal?.classList.remove('open');
      modal?.setAttribute('aria-hidden', 'true');
    }
    function openTermsModal() {
      modal?.classList.add('open');
      modal?.setAttribute('aria-hidden', 'false');
    }

    accept?.addEventListener('change', () => {
      document.getElementById('termsErr')?.classList.add('hidden');
      updateCheckoutTermsGate();
    });
    openBtn?.addEventListener('click', openTermsModal);
    backdrop?.addEventListener('click', closeTermsModal);
    closeBtn?.addEventListener('click', closeTermsModal);

    updateCheckoutTermsGate();
  }

  function cartTotals() {
    const cart      = getCart();
    const promoData = activePromoData();
    const lineSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const promoOn  = !!promoData;
    const promoPct = promoData?.percent || 0;
    const excludedIds = promoData ? (promoData.excludedProductIds || []).map(Number) : [];

    const eligibleSubtotal = promoOn
      ? cart.reduce((s, i) => excludedIds.includes(Number(i.id)) ? s : s + i.price * i.qty, 0)
      : 0;
    const ineligibleSubtotal = lineSubtotal - eligibleSubtotal;
    const discountAmt = promoOn
      ? Math.round(eligibleSubtotal * promoPct / 100 * 100) / 100
      : 0;
    const subtotalAfter = promoOn
      ? Math.round((eligibleSubtotal * (100 - promoPct) / 100 + ineligibleSubtotal) * 100) / 100
      : lineSubtotal;
    const total = Math.round((subtotalAfter + SHIPPING_USD) * 100) / 100;
    return {
      lineSubtotal,
      discountAmt,
      subtotal: subtotalAfter,
      shipping: SHIPPING_USD,
      total,
      totalUSD: total.toFixed(2),
      promoOn,
      promoPct,
    };
  }

  // ─── AZUL card payment ───────────────────────────────────────────────────────
  btnAzulPay?.addEventListener('click', async () => {
    if (!validateShipping()) return;
    if (!validateTerms()) return;
    const cart     = getCart();
    if (!cart.length) return;
    const shipping = getShippingInfo();
    const { total } = cartTotals();

    btnAzulPay.disabled = true;
    btnAzulPay.textContent = 'Procesando...';

    try {
      const res  = await fetch('/api/azul/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          total,
          shipping,
          promoCode: activePromoCode() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al iniciar el pago.');
        btnAzulPay.disabled = false;
        btnAzulPay.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pagar con tarjeta`;
        return;
      }
      // Auto-submit hidden form to AZUL
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.azulUrl;
      Object.entries(data.fields).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = k; input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      localStorage.setItem('calziani_pending_order', data.orderNumber);
      // Store purchase context for the success page Purchase event
      localStorage.setItem('calziani_pending_purchase', JSON.stringify({
        total,
        numItems: cart.reduce((s, i) => s + i.qty, 0),
        orderId:  data.orderNumber,
        trackingCode: data.trackingCode || '',
        trackingUrl: data.trackingUrl || '',
        name:     shipping.name,
        phone:    shipping.phone,
        country:  shipping.country,
      }));
      await window.CalzianiPixel?.trackInitiateCheckout(cart, total);
      form.submit();
    } catch (e) {
      alert('Error de conexión. Intentá nuevamente.');
      btnAzulPay.disabled = false;
      btnAzulPay.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pagar con tarjeta`;
    }
  });

  btnWhatsapp?.addEventListener('click', async () => {
    const cart = getCart();
    if (!cart.length) return;
    if (!validateShipping()) return;
    if (!validateTerms()) return;
    const ship = getShippingInfo();
    const ct = cartTotals();
    const btn = btnWhatsapp;
    const prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Guardando pedido...';

    let orderNumber = '';
    let trackingCode = '';
    let trackingUrl = '';
    try {
      const saveRes = await fetch('/api/orders/whatsapp-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          cart,
          shipping: ship,
          subtotal: ct.subtotal,
          shippingFee: SHIPPING_USD,
          total: ct.total,
          promoCode: activePromoCode() || undefined,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        alert(saveData.error || 'No se pudo guardar el pedido.');
        btn.disabled = false;
        btn.innerHTML = prevHtml;
        updateCheckoutTermsGate();
        return;
      }
      orderNumber = saveData.orderNumber || '';
      trackingCode = saveData.trackingCode || '';
      trackingUrl = saveData.trackingUrl || (trackingCode ? `${location.origin}/tracking?code=${encodeURIComponent(trackingCode)}` : '');
      window.CalzianiPixel?.trackInitiateCheckout(cart, ct.total);
      setPromoCalziani(false);
      if (promoCodeInput) promoCodeInput.value = '';
      promoClearBtn?.classList.add('hidden');
    } catch {
      alert('Error de conexión.');
      btn.disabled = false;
      btn.innerHTML = prevHtml;
      updateCheckoutTermsGate();
      return;
    }

    const items = cart.map(i => `• ${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty} — ${formatUsdCheckout(i.price * i.qty)} / ${formatDopCheckout(i.price * i.qty)}`).join('\n');
    const msg = [
      `Hola! Quiero confirmar mi pedido en Calziani 🛍️`,
      orderNumber ? `Pedido: *${orderNumber}*` : '',
      trackingCode ? `Código de tracking: *${trackingCode}*` : '',
      trackingUrl ? `Link de tracking: ${trackingUrl}` : '',
      ``,
      items,
      ``,
      `Subtotal: ${formatUsdCheckout(ct.lineSubtotal)} / ${formatDopCheckout(ct.lineSubtotal)}`,
      ...(ct.promoOn
        ? [`Descuento promocional −${ct.promoPct}%: ${formatUsdCheckout(ct.discountAmt)} / ${formatDopCheckout(ct.discountAmt)}`]
        : []),
      `Envío: ${formatUsdCheckout(SHIPPING_USD)} / ${formatDopCheckout(SHIPPING_USD)}`,
      `*Total: ${formatUsdCheckout(ct.total)} / ${formatDopCheckout(ct.total)}*`,
      ``,
      `📦 Datos de envío:`,
      `Nombre: ${ship.name}`,
      `Teléfono: ${ship.phone}`,
      `País: ${ship.country}`,
      `Provincia: ${ship.province}`,
      `Dirección: ${ship.address}`,
      ``,
      `Adjunto comprobante de transferencia.`,
      ``,
      activeLang === 'en'
        ? '✓ I confirm that I accepted Calziani\'s terms and conditions.'
        : '✓ Confirmo que acepté los términos y condiciones de Calziani.',
    ].filter(Boolean).join('\n');
    const phone = (payConfig.whatsapp || '18093076122').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    // Clear cart so the order cannot be submitted a second time
    localStorage.removeItem('calziani_cart');

    const cartBody = document.getElementById('cartBody');
    if (cartBody) {
      cartBody.innerHTML = `
        <div style="padding:28px 20px;text-align:center">
          <div style="width:52px;height:52px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.4rem">✓</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:6px">¡Pedido registrado!</h3>
          <p style="font-size:0.82rem;color:#555;margin-bottom:4px">Pedido: <strong>${orderNumber}</strong></p>
          <p style="font-size:0.82rem;color:#555;margin-bottom:16px">Envianos el comprobante de transferencia por WhatsApp para confirmar tu pedido.</p>
          ${trackingUrl ? `<a href="${trackingUrl}" target="_blank" style="font-size:0.8rem;color:#111;text-decoration:underline;display:block;margin-bottom:14px">Ver seguimiento de pedido</a>` : ''}
          <button onclick="location.href='/'" style="background:#111;color:#fff;border:none;padding:10px 24px;font-size:0.8rem;font-weight:700;letter-spacing:0.08em;cursor:pointer;border-radius:2px">Seguir comprando</button>
        </div>`;
    }
    updateCartUI();
  });

  // ─── Size filter bar ────────────────────────────────────────────────────────
  function renderSizeFilter(category) {
    const sizes = category !== 'all' ? SIZES_BY_CATEGORY[category] : null;
    if (!sizes) { sizeFilterBar.classList.add('hidden'); currentSize = 'all'; return; }

    sizeFilterBar.classList.remove('hidden');
    sizeFilterBtns.innerHTML =
      `<button class="size-btn${currentSize === 'all' ? ' active' : ''}" data-size="all">Todos</button>` +
      sizes.map(s => `<button class="size-btn${currentSize === s ? ' active' : ''}" data-size="${s}">${s}</button>`).join('');

    sizeFilterBtns.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSize = btn.dataset.size;
        currentProductsPage = 1;
        sizeFilterBtns.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetchProducts(currentCategory, searchInput.value, currentSize, 1);
      });
    });
  }

  let lastProducts = [];
  let lastSaleProducts = [];
  const STOREFRONT_PER_PAGE = 12;
  let currentProductsPage = 1;

  // ─── Fetch & render ─────────────────────────────────────────────────────────
  async function fetchProducts(category = 'all', search = '', size = 'all', page = currentProductsPage, brand = currentBrand) {
    currentProductsPage = page;
    grid.innerHTML = '<div class="loading">Cargando...</div>';
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search.trim()) params.set('search', search.trim());
    if (size !== 'all') params.set('size', size);
    if (brand !== 'all') params.set('brand_id', brand);
    params.set('page', page);
    params.set('limit', STOREFRONT_PER_PAGE);

    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      lastProducts = data.products;
      renderProducts(data.products, data.total, data.page, data.pages);
    } catch {
      grid.innerHTML = '<div class="empty-state"><span class="empty-state__icon">!</span>Error al cargar productos.</div>';
    }
  }

  function renderPagination(page, pages) {
    if (!pages || pages <= 1) return '';
    const prev = page > 1
      ? `<button class="store-page-btn" data-page="${page - 1}">&#8592;</button>`
      : `<button class="store-page-btn" disabled>&#8592;</button>`;
    const next = page < pages
      ? `<button class="store-page-btn" data-page="${page + 1}">&#8594;</button>`
      : `<button class="store-page-btn" disabled>&#8594;</button>`;
    const dots = Array.from({ length: pages }, (_, i) => i + 1).map(n =>
      `<button class="store-page-dot${n === page ? ' active' : ''}" data-page="${n}">${n}</button>`
    ).join('');
    return `<div class="store-pagination">${prev}${dots}${next}</div>`;
  }

  function renderProducts(products, total, page, pages) {
    sectionTitle.textContent = TITLE_MAP[currentCategory] || 'Productos';
    productCount.textContent = total != null
      ? `${total} resultado${total !== 1 ? 's' : ''}` : '';

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-state__icon">—</span>No hay productos en esta categoría aún.</div>`;
      return;
    }

    // Coupon badges: use applied promo first, then fall back to best available promo
    const _appliedPromo = activePromoData();
    const _bestPromo    = _appliedPromo || _bestAvailablePromo;
    const _promo        = _bestPromo;
    const _promoExcIds  = _promo ? (_promo.excludedProductIds || []).map(Number) : [];

    grid.innerHTML = products.map(p => {
      const isOffer  = p.compare_price && p.compare_price > p.price;
      const discount = isOffer ? Math.round(Math.round((1 - p.price / p.compare_price) * 100) / 10) * 10 : 0;
      const avail    = aggregateStock(p);
      const sl       = stockLabel(avail);
      const fav      = isFav(p.id);

      // Coupon eligibility
      const promoEligible = _promo && !_promoExcIds.includes(Number(p.id));
      const basePrice     = isOffer ? p.price : p.price; // price after any compare_price offer
      const couponAmt     = promoEligible ? Math.round(basePrice * _promo.percent / 100 * 100) / 100 : 0;
      const priceAfterCoupon = promoEligible ? Math.round((basePrice - couponAmt) * 100) / 100 : 0;

      const imgHtml = p.cover
        ? `<img src="/img/products/${escHtml(p.cover)}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
        : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;

      const badgeHtml = isOffer
        ? `<span class="product-card__sale-badge">−${discount}%</span>`
        : (sl.cls === 'out' ? `<span class="product-card__stock-badge out">${t('out_of_stock')}</span>` : '');

      const socialBadgeHtml = p.category === 'calzado' && p.customer_photo_count > 0
        ? `<span class="product-card__social-badge">Clientes reales</span>`
        : '';

      const priceHtml = isOffer
        ? `<span class="pc-price pc-price--sale">${formatPrice(p.price)}</span><span class="pc-price-orig">${formatPrice(p.compare_price)}</span>`
        : `<span class="pc-price">${formatPrice(p.price)}</span>`;

      const couponLabel = `− ${formatPrice(couponAmt)} cupón`;
      const couponHtml = promoEligible ? `
        <div class="pc-coupon-block">
          <span class="pc-coupon-badge">${couponLabel}</span>
          <span class="pc-coupon-after">${formatPrice(priceAfterCoupon)} con cupón</span>
        </div>` : '';

      return `<div class="product-card-wrap">
        <a class="product-card" href="/product/${p.id}" aria-label="Ver ${escHtml(p.name)}">
          <div class="product-card__media">
            ${imgHtml}
            ${badgeHtml}
            ${socialBadgeHtml}
            <button class="pc-fav-btn${fav ? ' active' : ''}" data-id="${p.id}" aria-label="Favorito" title="Favorito">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
          </div>
          <div class="product-card__info">
            <p class="pc-category">${CATEGORY_LABELS[p.category] || p.category}</p>
            <h3 class="pc-name">${escHtml(p.name)}</h3>
            <div class="pc-pricing">${priceHtml}</div>
            ${couponHtml}
            ${p.sizes && p.sizes.length ? `<div class="pc-sizes">${p.sizes.map(s => `<span class="pc-size">${s}</span>`).join('')}</div>` : ''}
          </div>
        </a>
      </div>`;
    }).join('');

    // Fav buttons
    grid.querySelectorAll('.pc-fav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const id  = btn.dataset.id;
        const now = toggleFav(id);
        btn.classList.toggle('active', now);
        btn.querySelector('svg').setAttribute('fill', now ? 'currentColor' : 'none');
      });
    });

    // Inject pagination below the grid
    let paginationEl = document.getElementById('storefrontPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'storefrontPagination';
      grid.parentNode.insertBefore(paginationEl, grid.nextSibling);
    }
    paginationEl.innerHTML = renderPagination(page, pages);
    paginationEl.querySelectorAll('.store-page-btn[data-page], .store-page-dot[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.page);
        fetchProducts(currentCategory, searchInput.value, currentSize, p);
        window.scrollTo({ top: document.getElementById('products')?.offsetTop - 80 || 0, behavior: 'smooth' });
      });
    });
  }

  // ─── Category nav ────────────────────────────────────────────────────────────
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      currentSize  = 'all';
      currentBrand = 'all';
      currentProductsPage = 1;
      renderSizeFilter(currentCategory);
      updateBrandFilterActive();
      fetchProducts(currentCategory, searchInput.value, currentSize, 1, 'all');
    });
  });

  // ─── Brand filter ─────────────────────────────────────────────────────────────
  function updateBrandFilterActive() {
    if (!brandFilterBtns) return;
    brandFilterBtns.querySelectorAll('.brand-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.brand === String(currentBrand));
    });
  }

  async function initBrandFilter() {
    try {
      const res    = await fetch('/api/brands');
      const brands = res.ok ? await res.json() : [];
      if (!brands.length || !brandFilterBar) return;

      // Pre-select brand from ?brand= URL param (matched by name, case-insensitive)
      const _brandParam = new URLSearchParams(window.location.search).get('brand');
      if (_brandParam) {
        const match = brands.find(b => b.name.toLowerCase() === _brandParam.toLowerCase().trim());
        if (match) {
          currentBrand = match.id;
          history.replaceState(null, '', '/');
        }
      }

      brandFilterBtns.innerHTML =
        `<button class="brand-btn${currentBrand === 'all' ? ' active' : ''}" data-brand="all">Todas</button>` +
        brands.map(b => `<button class="brand-btn${b.id === currentBrand ? ' active' : ''}" data-brand="${b.id}">${escHtml(b.name)}</button>`).join('');
      brandFilterBar.classList.remove('hidden');

      if (currentBrand !== 'all') {
        fetchProducts(currentCategory, searchInput.value, currentSize, 1, currentBrand);
      }

      brandFilterBtns.addEventListener('click', e => {
        const btn = e.target.closest('.brand-btn');
        if (!btn) return;
        currentBrand = btn.dataset.brand === 'all' ? 'all' : Number(btn.dataset.brand);
        currentProductsPage = 1;
        updateBrandFilterActive();
        fetchProducts(currentCategory, searchInput.value, currentSize, 1, currentBrand);
      });
    } catch { /* no brands, hide bar */ }
  }

  // ─── Search ──────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    currentProductsPage = 1;
    searchTimer = setTimeout(() => fetchProducts(currentCategory, searchInput.value, currentSize, 1, currentBrand), 350);
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  const authModal      = document.getElementById('authModal');
  const authBackdrop   = document.getElementById('authBackdrop');
  const authModalClose = document.getElementById('authModalClose');
  const headerUser     = document.getElementById('headerUser');
  const userDropdown   = document.getElementById('userDropdown');
  const logoutBtn      = document.getElementById('logoutBtn');
  const authTabs       = document.querySelectorAll('.auth-tab');
  const authPanels     = document.querySelectorAll('.auth-panel');
  const loginError     = document.getElementById('loginError');
  const registerError  = document.getElementById('registerError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const regSubmitBtn   = document.getElementById('regSubmitBtn');
  const authBrandSub   = document.getElementById('authBrandSub');

  let currentUser  = null;

  function showAuthError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
  function hideAuthError(el) { el.classList.add('hidden'); }

  function openAuthModal(tab = 'login') {
    switchAuthTab(tab);
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (loginError) hideAuthError(loginError);
    if (registerError) hideAuthError(registerError);
    document.getElementById('loginEmail')?.value && (document.getElementById('loginEmail').value = '');
    document.getElementById('loginPassword')?.value && (document.getElementById('loginPassword').value = '');
    document.getElementById('regName')?.value && (document.getElementById('regName').value = '');
    document.getElementById('regEmail')?.value && (document.getElementById('regEmail').value = '');
    document.getElementById('regPassword')?.value && (document.getElementById('regPassword').value = '');
  }

  const BRAND_SUBS = { login: 'Bienvenido de nuevo', register: 'Creá tu cuenta gratis', forgot: 'Recuperar contraseña' };
  const tabsContainer = document.querySelector('.auth-tabs');

  function switchAuthTab(tab) {
    const isMeta = tab === 'forgot';
    if (tabsContainer) tabsContainer.classList.toggle('hidden', isMeta);
    authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    authPanels.forEach(p => {
      p.classList.toggle('active', p.id === `panel${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });
    if (authBrandSub) authBrandSub.textContent = BRAND_SUBS[tab] || '';
  }

  authTabs.forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
  document.querySelectorAll('.auth-link-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.dataset.to && switchAuthTab(btn.dataset.to));
  });

  document.getElementById('forgotBtn')?.addEventListener('click', () => switchAuthTab('forgot'));

  const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
  const forgotError     = document.getElementById('forgotError');
  const forgotSuccess   = document.getElementById('forgotSuccess');

  forgotSubmitBtn?.addEventListener('click', async () => {
    if (forgotError) hideAuthError(forgotError);
    if (forgotSuccess) forgotSuccess.classList.add('hidden');
    const email = document.getElementById('forgotEmail')?.value.trim();
    if (!email) { showAuthError(forgotError, 'Ingresá tu email.'); return; }

    forgotSubmitBtn.disabled = true;
    forgotSubmitBtn.textContent = 'Enviando...';
    try {
      const res  = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(forgotError, data.error); return; }
      forgotSuccess.textContent = '¡Listo! Si ese email existe, revisá tu bandeja de entrada (también el spam).';
      forgotSuccess.classList.remove('hidden');
      forgotSubmitBtn.textContent = 'Enviado ✓';
    } catch { showAuthError(forgotError, 'Error de conexión.'); forgotSubmitBtn.textContent = 'Enviar enlace'; }
    finally { forgotSubmitBtn.disabled = false; }
  });

  document.getElementById('loginTrigger')?.addEventListener('click', () => openAuthModal('login'));
  authModalClose?.addEventListener('click', closeAuthModal);
  authBackdrop?.addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && authModal?.classList.contains('open')) closeAuthModal(); });

  loginSubmitBtn?.addEventListener('click', async () => {
    hideAuthError(loginError);
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showAuthError(loginError, 'Completá todos los campos.'); return; }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Iniciando sesión...';
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(loginError, data.error); return; }
      setUserUI(data.user);
      closeAuthModal();
    } catch { showAuthError(loginError, 'Error de conexión.'); }
    finally { loginSubmitBtn.disabled = false; loginSubmitBtn.textContent = 'Iniciar sesión'; }
  });

  regSubmitBtn?.addEventListener('click', async () => {
    hideAuthError(registerError);
    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!name || !email || !password) { showAuthError(registerError, 'Completá todos los campos.'); return; }
    if (password.length < 6) { showAuthError(registerError, 'La contraseña debe tener al menos 6 caracteres.'); return; }

    regSubmitBtn.disabled = true;
    regSubmitBtn.textContent = 'Creando cuenta...';
    try {
      const res  = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(registerError, data.error); return; }
      setUserUI(data.user);
      closeAuthModal();
    } catch { showAuthError(registerError, 'Error de conexión.'); }
    finally { regSubmitBtn.disabled = false; regSubmitBtn.textContent = 'Crear cuenta'; }
  });

  function setUserUI(user) {
    currentUser = user;
    if (!user) {
      headerUser.innerHTML = `<button class="user-btn" id="loginTrigger">Iniciar sesión</button>`;
      document.getElementById('loginTrigger')?.addEventListener('click', () => openAuthModal('login'));
      return;
    }
    window.CalzianiPixel?.setAdvancedMatching(user);
    const initials  = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="user-avatar-img" alt="${escHtml(user.name)}" referrerpolicy="no-referrer" />`
      : `<span class="user-avatar-initials">${initials}</span>`;

    headerUser.innerHTML = `
      <button class="user-avatar-btn" id="userAvatarBtn" aria-label="Mi cuenta">
        <div class="user-avatar">${avatarHtml}</div>
        <span class="user-avatar-name">${escHtml(user.name.split(' ')[0])}</span>
      </button>`;

    document.getElementById('dropName').textContent  = user.name;
    document.getElementById('dropEmail').textContent = user.email;
    const dropAv = document.getElementById('dropAvatar');
    dropAv.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="" referrerpolicy="no-referrer" />`
      : `<span>${initials}</span>`;

    document.getElementById('userAvatarBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
      const rect = e.currentTarget.getBoundingClientRect();
      userDropdown.style.top   = (rect.bottom + 8) + 'px';
      userDropdown.style.right = (window.innerWidth - rect.right) + 'px';
    });
  }

  document.addEventListener('click', () => userDropdown?.classList.add('hidden'));

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    userDropdown.classList.add('hidden');
    setUserUI(null);
  });

  document.getElementById('btnGoogle')?.addEventListener('click', () => { window.location.href = '/auth/google'; });

  async function checkGoogle() {
    try {
      const res  = await fetch('/api/auth/google-enabled');
      const data = await res.json();
      if (!data.enabled) {
        document.querySelectorAll('.btn-google').forEach(b => b.classList.add('hidden'));
        document.querySelectorAll('.auth-divider').forEach(d => d.classList.add('hidden'));
      }
    } catch { /* ignore */ }
  }

  if (new URLSearchParams(window.location.search).get('auth') === 'success') {
    history.replaceState(null, '', '/');
  }

  // Open cart if redirected from product page with ?cart=open
  if (new URLSearchParams(window.location.search).get('cart') === 'open') {
    history.replaceState(null, '', '/');
    setTimeout(() => { openCart(); fireInitiateCheckout(); }, 300);
  }

  // Pre-fill search from ?q= param
  const _qParam = new URLSearchParams(window.location.search).get('q');
  if (_qParam) {
    searchInput.value = _qParam.trim();
    history.replaceState(null, '', '/');
    fetchProducts(currentCategory, searchInput.value, currentSize, 1, currentBrand);
  }

  async function initAuth() {
    try {
      const res  = await fetch('/api/auth/me');
      const data = await res.json();
      setUserUI(data.user);
    } catch { setUserUI(null); }
    checkGoogle();
  }

  // ─── Favorites header count ───────────────────────────────────────────────────
  function updateFavHeaderCount() {
    const cnt = getFavs().length;
    const el = document.getElementById('favHeaderCount');
    if (!el) return;
    el.textContent = cnt;
    el.classList.toggle('hidden', cnt === 0);
  }

  // ─── Sale section ─────────────────────────────────────────────────────────────
  async function loadSaleProducts() {
    try {
      const res  = await fetch('/api/products');
      const all  = await res.json();
      const sale = all.filter(p => p.compare_price && p.compare_price > p.price);
      lastSaleProducts = sale;
      const saleSection = document.getElementById('saleSection');
      const saleBanner  = document.getElementById('saleBanner');
      if (!sale.length) {
        lastSaleProducts = [];
        if (saleBanner) saleBanner.style.display = 'none';
        return;
      }
      // Wire banner button
      document.getElementById('saleBannerBtn')?.addEventListener('click', () => {
        saleSection?.classList.remove('hidden');
        saleSection?.scrollIntoView({ behavior: 'smooth' });
      });
      // Render sale grid
      const saleGrid = document.getElementById('saleGrid');
      if (!saleGrid) return;
      saleGrid.innerHTML = sale.map(p => {
        const discount = Math.round(Math.round((1 - p.price / p.compare_price) * 100) / 10) * 10;
        const imgHtml = p.cover
          ? `<img src="/img/products/${escHtml(p.cover)}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
          : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;
        const fav = isFav(p.id);
        const socialBadgeHtml = p.category === 'calzado' && p.customer_photo_count > 0
          ? `<span class="product-card__social-badge">Clientes reales</span>`
          : '';
        return `<div class="product-card-wrap">
          <a class="product-card" href="/product/${p.id}">
            <div class="product-card__media">
              ${imgHtml}
              <span class="product-card__sale-badge">−${discount}%</span>
              ${socialBadgeHtml}
              <button class="pc-fav-btn${fav ? ' active' : ''}" data-id="${p.id}" aria-label="Favorito">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>
            <div class="product-card__info">
              <p class="pc-category">${CATEGORY_LABELS[p.category] || p.category}</p>
              <h3 class="pc-name">${escHtml(p.name)}</h3>
              <div class="pc-pricing">
                <span class="pc-price pc-price--sale">${formatPrice(p.price)}</span>
                <span class="pc-price-orig">${formatPrice(p.compare_price)}</span>
              </div>
            </div>
          </a>
        </div>`;
      }).join('');

      // Wire fav + cart buttons in sale grid
      saleGrid.querySelectorAll('.pc-fav-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const id = btn.dataset.id;
          const now = toggleFav(id);
          btn.classList.toggle('active', now);
          btn.querySelector('svg').setAttribute('fill', now ? 'currentColor' : 'none');
          updateFavHeaderCount();
        });
      });
    } catch { /* ignore */ }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  applyTranslations();
  initLangBtn();
  renderSizeFilter(currentCategory);
  initBrandFilter();

  // Load best available promo for card badges (non-blocking)
  fetch('/api/promos/active')
    .then(r => r.ok ? r.json() : [])
    .then(promos => {
      if (promos.length) {
        _bestAvailablePromo = promos[0]; // already sorted by percent DESC
        // Re-render if products are already loaded
        if (lastProducts.length) renderProducts(lastProducts, lastProducts.length, currentProductsPage, null);
      }
    })
    .catch(() => {});

  loadCurrencyRates().then(() => {
    fetchProducts();
    loadSaleProducts();
    updateCartUI();
  });
  initCurrencySelect();
  initAuth();
  initTermsCheckout();
  initPromoCart();
  loadPaymentConfig();
  updateFavHeaderCount();

  // ─── Hide/show header on scroll ───────────────────────────────────────────────
  const header = document.querySelector('.header');
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 80) {
      header.classList.add('header--hidden');
    } else {
      header.classList.remove('header--hidden');
    }
    lastScrollY = currentScrollY;
  }, { passive: true });
})();
