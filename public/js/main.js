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

  const CATEGORY_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };
  const TITLE_MAP = {
    all: 'Todos los productos', calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorios',
  };
  const SIZES_BY_CATEGORY = {
    calzado:   ['35','36','37','38','39','40','41','42','43','44','45'],
    ropa:      ['XS','S','M','L','XL','XXL'],
    accesorio: ['Única talla'],
  };

  function formatPrice(price) {
    return 'RD$' + new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(price);
  }

  function stockLabel(stock) {
    if (stock === 0) return { text: 'Sin stock', cls: 'out' };
    if (stock <= 5)  return { text: `Últimas ${stock} unidades`, cls: 'low' };
    return { text: 'Disponible', cls: '' };
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
    if (existing) { existing.qty += 1; }
    else { cart.push({ ...product, qty: 1 }); }
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
    item.qty = Math.max(1, item.qty + delta);
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
  const cartSubtotal= document.getElementById('cartSubtotal');
  const cartItbis   = document.getElementById('cartItbis');
  const cartTotal   = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');

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
            <button class="qty-btn" data-id="${item.id}" data-size="${item.size||''}" data-delta="1">+</button>
          </div>
        </div>
        <div class="cart-item__right">
          <span class="cart-item__price">${formatPrice(item.price * item.qty)}</span>
          <button class="cart-item__remove" data-id="${item.id}" data-size="${item.size||''}" aria-label="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </li>`).join('');

    // Totals
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const itbis    = Math.round(subtotal * 0.18 * 100) / 100;
    const total    = Math.round((subtotal + itbis) * 100) / 100;
    cartSubtotal.textContent = formatPrice(subtotal);
    cartItbis.textContent    = formatPrice(itbis);
    cartTotal.textContent    = formatPrice(total);

    // Qty buttons
    cartItems.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => changeQty(btn.dataset.id, btn.dataset.size, Number(btn.dataset.delta)));
    });
    cartItems.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id, btn.dataset.size));
    });

    // Refresh USD note if PayPal visible
    if (activeMethod === 'paypal' && payConfig.usdRate && cartUsdNote) {
      const { totalUSD } = cartTotals();
      cartUsdNote.textContent = `≈ USD $${totalUSD} (tipo de cambio RD$${payConfig.usdRate})`;
    }
  }

  // ─── Payment methods ──────────────────────────────────────────────────────────
  let payConfig   = {};
  let paypalLoaded = false;
  let activeMethod = 'paypal';

  const payMethodTabs   = document.querySelectorAll('.pay-method-tab');
  const payPanelPaypal  = document.getElementById('payPanelPaypal');
  const payPanelTransfer= document.getElementById('payPanelTransfer');
  const transferInfo    = document.getElementById('transferInfo');
  const btnWhatsapp     = document.getElementById('btnWhatsapp');
  const cartUsdNote     = document.getElementById('cartUsdNote');

  payMethodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      payMethodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeMethod = tab.dataset.method;
      payPanelPaypal.classList.toggle('active', activeMethod === 'paypal');
      payPanelTransfer.classList.toggle('active', activeMethod === 'transfer');
      if (activeMethod === 'paypal' && !paypalLoaded) loadPayPal();
    });
  });

  async function loadPaymentConfig() {
    try {
      const res  = await fetch('/api/payment-config');
      payConfig  = await res.json();
      renderTransferInfo();
      if (payConfig.paypalClientId) loadPayPal();
      else {
        // Hide PayPal tab if not configured
        document.querySelector('[data-method="paypal"]')?.classList.add('pay-method-tab--disabled');
        payPanelPaypal.innerHTML = '<p class="pay-not-configured">PayPal no configurado aún.</p>';
      }
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

  function loadPayPal() {
    if (paypalLoaded || !payConfig.paypalClientId) return;
    paypalLoaded = true;
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${payConfig.paypalClientId}&currency=USD&locale=es_DO`;
    script.onload = renderPayPalButtons;
    document.head.appendChild(script);
  }

  function cartTotals() {
    const cart     = getCart();
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const itbis    = Math.round(subtotal * 0.18 * 100) / 100;
    const total    = Math.round((subtotal + itbis) * 100) / 100;
    const usdRate  = payConfig.usdRate || 57;
    const totalUSD = (total / usdRate).toFixed(2);
    return { subtotal, itbis, total, totalUSD };
  }

  function renderPayPalButtons() {
    const container = document.getElementById('paypalButtonContainer');
    if (!container || !window.paypal) return;
    container.innerHTML = '';

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 44 },

      createOrder: async () => {
        const cart = getCart();
        const res  = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        // Update USD note
        const { totalUSD } = cartTotals();
        if (cartUsdNote) cartUsdNote.textContent = `Total a pagar: USD $${totalUSD}`;
        return data.orderId;
      },

      onApprove: async (data) => {
        const res  = await fetch(`/api/paypal/capture-order/${data.orderID}`, { method: 'POST' });
        const captured = await res.json();
        if (captured.status === 'COMPLETED') {
          localStorage.removeItem('calziani_cart');
          window.location.href = '/payment/success?method=paypal';
        } else {
          alert('El pago no pudo completarse. Intentá nuevamente.');
        }
      },

      onError: (err) => {
        console.error('PayPal error', err);
        alert('Hubo un error con PayPal. Intentá de nuevo o usá transferencia.');
      },
    }).render('#paypalButtonContainer');

    // Show USD conversion note
    const { totalUSD } = cartTotals();
    if (cartUsdNote) cartUsdNote.textContent = `≈ USD $${totalUSD} (tipo de cambio RD$${payConfig.usdRate || 57})`;
  }

  btnWhatsapp?.addEventListener('click', () => {
    const cart   = getCart();
    if (!cart.length) return;
    const { total } = cartTotals();
    const items  = cart.map(i => `• ${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty} — ${formatPrice(i.price * i.qty)}`).join('\n');
    const msg    = `Hola! Quiero confirmar mi pedido en Calziani 🛍️\n\n${items}\n\n*Total: ${formatPrice(total)}*\nAdjunto comprobante de transferencia.`;
    const phone  = (payConfig.whatsapp || '18093076122').replace(/\D/g, '');
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
      renderProducts(await res.json());
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
            <button class="pc-cart-btn" data-id="${p.id}" data-name="${escHtml(p.name)}" data-price="${p.price}" data-cover="${escHtml(p.cover || '')}" aria-label="Agregar al carrito">
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
        addToCart({ id: Number(btn.dataset.id), name: btn.dataset.name, price: Number(btn.dataset.price), cover: btn.dataset.cover, size: '' });
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

  async function initAuth() {
    try {
      const res  = await fetch('/api/auth/me');
      const data = await res.json();
      setUserUI(data.user);
    } catch { setUserUI(null); }
    checkGoogle();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  renderSizeFilter(currentCategory);
  fetchProducts();
  initAuth();
  updateCartUI();
  loadPaymentConfig();

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
