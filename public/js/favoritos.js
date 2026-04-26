(() => {
  const CATEGORY_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };

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
      renderFavs(allProducts);
    });
  }

  // ─── Favorites ────────────────────────────────────────────────────────────────
  function getFavs() {
    try { return JSON.parse(localStorage.getItem('calziani_favs') || '[]'); } catch { return []; }
  }
  function saveFavs(favs) { localStorage.setItem('calziani_favs', JSON.stringify(favs)); }
  function toggleFav(id) {
    id = Number(id);
    const favs = getFavs();
    const idx = favs.indexOf(id);
    if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
    saveFavs(favs);
    return idx < 0;
  }

  // ─── Cart ─────────────────────────────────────────────────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('calziani_cart') || '[]'); } catch { return []; }
  }
  function saveCart(cart) { localStorage.setItem('calziani_cart', JSON.stringify(cart)); }
  function cartCount() { return getCart().reduce((s, i) => s + i.qty, 0); }

  function addToCart(product) {
    const cart = getCart();
    const key = `${product.id}__${product.size || ''}`;
    const existing = cart.find(i => `${i.id}__${i.size || ''}` === key);
    const maxQty = product.maxQty ?? Infinity;
    if (existing) {
      existing.qty = Math.min(maxQty, existing.qty + 1);
      if (product.maxQty !== undefined) existing.maxQty = product.maxQty;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    saveCart(cart);
    updateCartBadge();
  }

  function updateCartBadge() {
    const cnt = cartCount();
    const badge = document.getElementById('cartBadgeFav');
    if (badge) { badge.textContent = cnt; badge.classList.toggle('hidden', cnt === 0); }
  }

  function updateFavHeaderCount() {
    const cnt = getFavs().length;
    const el = document.getElementById('favHeaderCount');
    if (el) { el.textContent = cnt; el.classList.toggle('hidden', cnt === 0); }
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const grid     = document.getElementById('favGrid');
  const favCount = document.getElementById('favCount');
  let allProducts = [];

  function renderFavs(products) {
    if (!products.length) {
      grid.innerHTML = `
        <div class="favs-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <p>No tenés productos favoritos todavía.</p>
          <a href="/" class="btn-browse">Ver todos los productos</a>
        </div>`;
      if (favCount) favCount.textContent = '';
      return;
    }

    if (favCount) favCount.textContent = `${products.length} producto${products.length !== 1 ? 's' : ''}`;

    grid.innerHTML = products.map(p => {
      const isOffer  = p.compare_price && p.compare_price > p.price;
      const discount = isOffer ? Math.round((1 - p.price / p.compare_price) * 100) : 0;

      const imgHtml = p.cover
        ? `<img src="/img/products/${escHtml(p.cover)}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
        : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;

      const badgeHtml = isOffer ? `<span class="product-card__sale-badge">−${discount}%</span>` : '';

      const priceHtml = isOffer
        ? `<span class="pc-price pc-price--sale">${formatPrice(p.price)}</span><span class="pc-price-orig">${formatPrice(p.compare_price)}</span>`
        : `<span class="pc-price">${formatPrice(p.price)}</span>`;

      return `<div class="product-card-wrap" data-id="${p.id}">
        <a class="product-card" href="/product/${p.id}" aria-label="Ver ${escHtml(p.name)}">
          <div class="product-card__media">
            ${imgHtml}
            ${badgeHtml}
            <button class="pc-fav-btn active" data-id="${p.id}" aria-label="Quitar de favoritos" title="Quitar de favoritos">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
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

    // Fav remove buttons
    grid.querySelectorAll('.pc-fav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const id = Number(btn.dataset.id);
        toggleFav(id);
        // Remove card from DOM
        const card = grid.querySelector(`.product-card-wrap[data-id="${id}"]`);
        if (card) card.remove();
        allProducts = allProducts.filter(p => p.id !== id);
        updateFavHeaderCount();
        if (!allProducts.length) renderFavs([]);
        if (favCount) favCount.textContent = allProducts.length ? `${allProducts.length} producto${allProducts.length !== 1 ? 's' : ''}` : '';
      });
    });

    // Add to cart buttons
    grid.querySelectorAll('.pc-cart-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const stock = Number(btn.dataset.stock);
        addToCart({ id: Number(btn.dataset.id), name: btn.dataset.name, price: Number(btn.dataset.price), cover: btn.dataset.cover, size: '', maxQty: stock > 0 ? stock : undefined });
        btn.textContent = '✓';
        setTimeout(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Agregar`;
        }, 1500);
      });
    });
  }

  async function loadFavs() {
    const ids = getFavs();
    if (!ids.length) { renderFavs([]); return; }

    try {
      const res = await fetch(`/api/products/by-ids?ids=${ids.join(',')}`);
      if (!res.ok) throw new Error();
      allProducts = await res.json();
      renderFavs(allProducts);
    } catch {
      grid.innerHTML = '<div class="loading">Error al cargar favoritos.</div>';
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  loadCurrencyRates().then(() => {
    loadFavs();
    initCurrencySelect();
  });
  updateCartBadge();
  updateFavHeaderCount();

  // ─── Hide/show header on scroll ───────────────────────────────────────────────
  const header = document.querySelector('.header');
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const cur = window.scrollY;
    if (cur > lastScrollY && cur > 80) header.classList.add('header--hidden');
    else header.classList.remove('header--hidden');
    lastScrollY = cur;
  }, { passive: true });
})();
