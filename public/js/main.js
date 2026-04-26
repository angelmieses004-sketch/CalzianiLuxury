(() => {
  const grid          = document.getElementById('productGrid');
  const sectionTitle  = document.getElementById('sectionTitle');
  const productCount  = document.getElementById('productCount');
  const searchInput   = document.getElementById('searchInput');
  const navBtns       = document.querySelectorAll('.nav-btn');
  const sizeFilterBar = document.getElementById('sizeFilterBar');
  const sizeFilterBtns= document.getElementById('sizeFilterBtns');

  let currentCategory = 'all';
  let currentSize     = 'all';
  let searchTimer     = null;

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
      last_units:         'Últimas',
      units:              'unidades',
      out_of_stock:       'Sin stock',
      add_to_cart:        'Agregar',
      cat_label_calzado:  'Calzado',
      cat_label_ropa:     'Ropa',
      cat_label_accesorio:'Accesorio',
      title_all:          'Todos los productos',
      title_calzado:      'Calzado',
      title_ropa:         'Ropa',
      title_accesorio:    'Accesorios',
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
      last_units:         'Last',
      units:              'units',
      out_of_stock:       'Out of stock',
      add_to_cart:        'Add',
      cat_label_calzado:  'Footwear',
      cat_label_ropa:     'Clothing',
      cat_label_accesorio:'Accessory',
      title_all:          'All products',
      title_calzado:      'Footwear',
      title_ropa:         'Clothing',
      title_accesorio:    'Accessories',
    },
  };

  let activeLang = localStorage.getItem('calziani_lang') || 'es';

  function t(key) { return T[activeLang]?.[key] || T.es[key] || key; }

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
    if (stock <= 5)  return { text: `${t('last_units')} ${stock} ${t('units')}`, cls: 'low' };
    return { text: t('available'), cls: '' };
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
  }

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
  const checkoutBtn   = document.getElementById('checkoutBtn');

  const SHIPPING_USD  = 5; // flat shipping fee in USD

  function openCart()  { cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
  function closeCart() { cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }

  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cartDrawer?.classList.contains('open')) closeCart(); });

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
      return;
    }
    cartEmpty.classList.add('hidden');
    cartItems.classList.remove('hidden');
    cartFoot.classList.remove('hidden');

    // Items
    cartItems.innerHTML = cart.map(item => `
      <li class="cart-item">
        <div class="cart-item__img">
          ${item.cover
            ? `<img src="/img/products/${escHtml(item.cover)}" alt="${escHtml(item.name)}" />`
            : `<div class="cart-item__img-empty">C</div>`}
        </div>
        <div class="cart-item__info">
          <p class="cart-item__name">${escHtml(item.name)}</p>
          ${item.size ? `<p class="cart-item__size">Talle: ${escHtml(item.size)}</p>` : ''}
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
      </li>`).join('');

    // Totals (USD + DOP for transfer / local customers)
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total    = subtotal + SHIPPING_USD;
    if (cartSubtotalUsd) cartSubtotalUsd.textContent = formatUsdCheckout(subtotal);
    if (cartSubtotalDop) cartSubtotalDop.textContent = formatDopCheckout(subtotal);
    if (cartShippingUsd) cartShippingUsd.textContent = formatUsdCheckout(SHIPPING_USD);
    if (cartShippingDop) cartShippingDop.textContent = formatDopCheckout(SHIPPING_USD);
    if (cartTotalUsd) cartTotalUsd.textContent = formatUsdCheckout(total);
    if (cartTotalDop) cartTotalDop.textContent = formatDopCheckout(total);

    // Qty buttons
    cartItems.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => changeQty(btn.dataset.id, btn.dataset.size, Number(btn.dataset.delta)));
    });
    cartItems.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id, btn.dataset.size));
    });

    // Refresh USD note if PayPal visible
    if (activeMethod === 'paypal' && cartUsdNote) {
      const { totalUSD } = cartTotals();
      cartUsdNote.textContent = `Total PayPal: USD $${totalUSD}`;
    }
  }

  // ─── Payment methods ──────────────────────────────────────────────────────────
  let payConfig   = {};
  let activeMethod = 'transfer';

  const payMethodTabs    = document.querySelectorAll('.pay-method-tab');
  const payPanelCard     = document.getElementById('payPanelCard');
  const payPanelTransfer = document.getElementById('payPanelTransfer');
  const transferInfo     = document.getElementById('transferInfo');
  const btnWhatsapp      = document.getElementById('btnWhatsapp');
  const btnAzulPay       = document.getElementById('btnAzulPay');
  const azulNote         = document.getElementById('azulNote');

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
      // Show DOP total note in AZUL panel
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

  function cartTotals() {
    const cart        = getCart();
    const subtotalUSD = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total       = Math.round((subtotalUSD + SHIPPING_USD) * 100) / 100;
    return { subtotal: subtotalUSD, shipping: SHIPPING_USD, total, totalUSD: total.toFixed(2) };
  }

  // ─── AZUL card payment ───────────────────────────────────────────────────────
  btnAzulPay?.addEventListener('click', async () => {
    if (!validateShipping()) return;
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
        body: JSON.stringify({ cart, total, shipping }),
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
      form.submit();
    } catch (e) {
      alert('Error de conexión. Intentá nuevamente.');
      btnAzulPay.disabled = false;
      btnAzulPay.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pagar con tarjeta`;
    }
  });

  btnWhatsapp?.addEventListener('click', () => {
    const cart = getCart();
    if (!cart.length) return;
    if (!validateShipping()) return;
    const ship = getShippingInfo();
    const { subtotal, total } = cartTotals();
    const items = cart.map(i => `• ${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty} — ${formatUsdCheckout(i.price * i.qty)} / ${formatDopCheckout(i.price * i.qty)}`).join('\n');
    const msg = [
      `Hola! Quiero confirmar mi pedido en Calziani 🛍️`,
      ``,
      items,
      ``,
      `Subtotal: ${formatUsdCheckout(subtotal)} / ${formatDopCheckout(subtotal)}`,
      `Envío: ${formatUsdCheckout(SHIPPING_USD)} / ${formatDopCheckout(SHIPPING_USD)}`,
      `*Total: ${formatUsdCheckout(total)} / ${formatDopCheckout(total)}*`,
      ``,
      `📦 Datos de envío:`,
      `Nombre: ${ship.name}`,
      `Teléfono: ${ship.phone}`,
      `País: ${ship.country}`,
      `Provincia: ${ship.province}`,
      `Dirección: ${ship.address}`,
      ``,
      `Adjunto comprobante de transferencia.`,
    ].join('\n');
    const phone = (payConfig.whatsapp || '18093076122').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
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
        sizeFilterBtns.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetchProducts(currentCategory, searchInput.value, currentSize);
      });
    });
  }

  let lastProducts = [];

  // ─── Fetch & render ─────────────────────────────────────────────────────────
  async function fetchProducts(category = 'all', search = '', size = 'all') {
    grid.innerHTML = '<div class="loading">Cargando...</div>';
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search.trim()) params.set('search', search.trim());
    if (size !== 'all') params.set('size', size);

    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      lastProducts = await res.json();
      renderProducts(lastProducts);
    } catch {
      grid.innerHTML = '<div class="empty-state"><span class="empty-state__icon">!</span>Error al cargar productos.</div>';
    }
  }

  function renderProducts(products) {
    sectionTitle.textContent = TITLE_MAP[currentCategory] || 'Productos';
    productCount.textContent = products.length
      ? `${products.length} resultado${products.length !== 1 ? 's' : ''}` : '';

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-state__icon">—</span>No hay productos en esta categoría aún.</div>`;
      return;
    }

    grid.innerHTML = products.map(p => {
      const isOffer  = p.compare_price && p.compare_price > p.price;
      const discount = isOffer ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
      const sl       = stockLabel(p.stock);
      const fav      = isFav(p.id);

      const imgHtml = p.cover
        ? `<img src="/img/products/${escHtml(p.cover)}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
        : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;

      const badgeHtml = isOffer
        ? `<span class="product-card__sale-badge">−${discount}%</span>`
        : (sl.cls === 'out' ? `<span class="product-card__stock-badge out">Sin stock</span>` : '');

      const priceHtml = isOffer
        ? `<span class="pc-price pc-price--sale">${formatPrice(p.price)}</span><span class="pc-price-orig">${formatPrice(p.compare_price)}</span>`
        : `<span class="pc-price">${formatPrice(p.price)}</span>`;

      return `<div class="product-card-wrap">
        <a class="product-card" href="/product/${p.id}" aria-label="Ver ${escHtml(p.name)}">
          <div class="product-card__media">
            ${imgHtml}
            ${badgeHtml}
            <button class="pc-fav-btn${fav ? ' active' : ''}" data-id="${p.id}" aria-label="Favorito" title="Favorito">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button class="pc-cart-btn" data-id="${p.id}" data-name="${escHtml(p.name)}" data-price="${p.price}" data-cover="${escHtml(p.cover || '')}" data-stock="${p.stock}" aria-label="Agregar al carrito">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Agregar
            </button>
          </div>
          <div class="product-card__info">
            <p class="pc-category">${CATEGORY_LABELS[p.category] || p.category}</p>
            <h3 class="pc-name">${escHtml(p.name)}</h3>
            <div class="pc-pricing">${priceHtml}</div>
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

    // Add to cart buttons
    grid.querySelectorAll('.pc-cart-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const stock = Number(btn.dataset.stock);
        addToCart({ id: Number(btn.dataset.id), name: btn.dataset.name, price: Number(btn.dataset.price), cover: btn.dataset.cover, size: '', maxQty: stock > 0 ? stock : undefined });
      });
    });
  }

  // ─── Category nav ────────────────────────────────────────────────────────────
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      currentSize = 'all';
      renderSizeFilter(currentCategory);
      fetchProducts(currentCategory, searchInput.value, currentSize);
    });
  });

  // ─── Search ──────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchProducts(currentCategory, searchInput.value, currentSize), 350);
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
    setTimeout(openCart, 300);
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
      const saleSection = document.getElementById('saleSection');
      const saleBanner  = document.getElementById('saleBanner');
      if (!sale.length) {
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
        const discount = Math.round((1 - p.price / p.compare_price) * 100);
        const imgHtml = p.cover
          ? `<img src="/img/products/${escHtml(p.cover)}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
          : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;
        const fav = isFav(p.id);
        return `<div class="product-card-wrap">
          <a class="product-card" href="/product/${p.id}">
            <div class="product-card__media">
              ${imgHtml}
              <span class="product-card__sale-badge">−${discount}%</span>
              <button class="pc-fav-btn${fav ? ' active' : ''}" data-id="${p.id}" aria-label="Favorito">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button class="pc-cart-btn" data-id="${p.id}" data-name="${escHtml(p.name)}" data-price="${p.price}" data-cover="${escHtml(p.cover || '')}" data-stock="${p.stock}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                ${t('add_to_cart')}
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
      saleGrid.querySelectorAll('.pc-cart-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const stock = Number(btn.dataset.stock);
          addToCart({ id: Number(btn.dataset.id), name: btn.dataset.name, price: Number(btn.dataset.price), cover: btn.dataset.cover, size: '', maxQty: stock > 0 ? stock : undefined });
        });
      });
    } catch { /* ignore */ }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  applyTranslations();
  initLangBtn();
  renderSizeFilter(currentCategory);
  loadCurrencyRates().then(() => {
    fetchProducts();
    loadSaleProducts();
    updateCartUI();
  });
  initCurrencySelect();
  initAuth();
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
