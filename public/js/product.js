(() => {
  const CATEGORY_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };

  // ─── Currency ────────────────────────────────────────────────────────────────
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
      if (product) render(product);
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function stockLabel(stock) {
    if (stock === 0) return { text: 'Sin stock', cls: 'out' };
    if (stock <= 5)  return { text: `Últimas ${stock} unidades`, cls: 'low' };
    return { text: 'En stock', cls: '' };
  }

  // ─── Cart (localStorage, shared with main page) ───────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('calziani_cart') || '[]'); } catch { return []; }
  }
  function saveCart(cart) { localStorage.setItem('calziani_cart', JSON.stringify(cart)); }

  function addToCart(productData) {
    const cart = getCart();
    const key  = `${productData.id}__${productData.size || ''}`;
    const existing = cart.find(i => `${i.id}__${i.size || ''}` === key);
    const maxQty = productData.maxQty ?? Infinity;
    if (existing) {
      existing.qty = Math.min(maxQty, existing.qty + 1);
      if (productData.maxQty !== undefined) existing.maxQty = productData.maxQty;
    } else {
      cart.push({ ...productData, qty: 1 });
    }
    saveCart(cart);
    updateCartBadge();
  }

  function updateCartBadge() {
    const count  = getCart().reduce((s, i) => s + i.qty, 0);
    const badge  = document.getElementById('cartBadgeProduct');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  }

  // ─── Favorites ────────────────────────────────────────────────────────────
  function getFavs() { try { return JSON.parse(localStorage.getItem('calziani_favs') || '[]'); } catch { return []; } }
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

  const page = document.getElementById('productPage');
  const id   = location.pathname.split('/').pop();
  let selectedSize = '';
  let product = null;

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('not found');
      product = await res.json();
      render(product);
      updateCartBadge();
    } catch {
      page.innerHTML = `
        <div class="pp-error">
          <p>Producto no encontrado.</p>
          <a href="/" class="pp-back-link">← Volver a la tienda</a>
        </div>`;
    }
  }

  function render(p) {
    const isOffer  = p.compare_price && p.compare_price > p.price;
    const discount = isOffer ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
    const sl       = stockLabel(p.stock);
    const images   = p.images || [];
    const fav      = isFav(p.id);

    document.title = `${p.name} — Calziani`;

    // ── Gallery HTML ──────────────────────────────────────────────────────────
    let galleryHtml = '';
    if (images.length === 0) {
      galleryHtml = `<div class="pp-gallery pp-gallery--empty"><span>CALZIANI</span></div>`;
    } else if (images.length === 1) {
      galleryHtml = `
        <div class="pp-gallery">
          <div class="pp-gallery__main">
            <img src="/img/products/${images[0].filename}" alt="${escHtml(p.name)}" class="pp-gallery__main-img" id="ppMainImg" />
          </div>
        </div>`;
    } else {
      const thumbs = images.map((img, i) =>
        `<button class="pp-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" type="button">
          <img src="/img/products/${img.filename}" alt="" loading="lazy" />
        </button>`
      ).join('');
      galleryHtml = `
        <div class="pp-gallery">
          <div class="pp-gallery__main">
            <img src="/img/products/${images[0].filename}" alt="${escHtml(p.name)}" class="pp-gallery__main-img" id="ppMainImg" />
            <button class="pp-arrow pp-arrow--prev" id="ppPrev">&#8249;</button>
            <button class="pp-arrow pp-arrow--next" id="ppNext">&#8250;</button>
          </div>
          <div class="pp-thumbs" id="ppThumbs">${thumbs}</div>
        </div>`;
    }

    // ── Price HTML ────────────────────────────────────────────────────────────
    const priceHtml = isOffer
      ? `<div class="pp-pricing">
           <span class="pp-badge-offer">−${discount}% OFERTA</span>
           <span class="pp-price pp-price--sale">${formatPrice(p.price)}</span>
           <span class="pp-price-orig">${formatPrice(p.compare_price)}</span>
         </div>`
      : `<div class="pp-pricing"><span class="pp-price">${formatPrice(p.price)}</span></div>`;

    // ── Sizes HTML (selectable) ───────────────────────────────────────────────
    const sizesHtml = p.sizes && p.sizes.length
      ? `<div class="pp-sizes">
           <p class="pp-label">Talle <span class="pp-size-selected" id="ppSizeSelected"></span></p>
           <div class="pp-sizes-list" id="ppSizesList">
             ${p.sizes.map(s => `<button class="pp-size-tag pp-size-btn" data-size="${escHtml(s)}" type="button">${escHtml(s)}</button>`).join('')}
           </div>
           <p class="pp-size-err hidden" id="ppSizeErr">Seleccioná un talle para continuar.</p>
         </div>`
      : '';

    // ── Shipping & Stock HTML ─────────────────────────────────────────────────
    const shipHtml = p.shipping_days
      ? `<div class="pp-ship">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="m16 8 5 0 2 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
           Envío: ${escHtml(p.shipping_days)}
         </div>`
      : '';
    const stockHtml = `<p class="pp-stock pp-stock--${sl.cls || 'ok'}">${sl.text}</p>`;

    // ── CTA Buttons ──────────────────────────────────────────────────────────
    const outOfStock = p.stock === 0;
    const ctaHtml = `
      <div class="pp-cta">
        <button class="pp-btn-cart${outOfStock ? ' disabled' : ''}" id="ppAddCart" ${outOfStock ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          ${outOfStock ? 'Sin stock' : 'Agregar al carrito'}
        </button>
        ${!outOfStock ? `<button class="pp-btn-buy" id="ppBuyNow">Comprar ahora</button>` : ''}
        <button class="pp-btn-fav${fav ? ' active' : ''}" id="ppFavBtn" aria-label="Favorito">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          ${fav ? 'En favoritos' : 'Agregar a favoritos'}
        </button>
      </div>`;

    page.innerHTML = `
      <div class="pp-container">
        <a href="/" class="pp-back">← Volver</a>
        <div class="pp-layout">
          ${galleryHtml}
          <div class="pp-info">
            <p class="pp-category">${CATEGORY_LABELS[p.category] || p.category}</p>
            <h1 class="pp-name">${escHtml(p.name)}</h1>
            ${priceHtml}
            ${shipHtml}
            ${stockHtml}
            ${sizesHtml}
            ${ctaHtml}
            ${p.description ? `<div class="pp-desc"><p class="pp-label">Descripción</p><p>${escHtml(p.description)}</p></div>` : ''}
          </div>
        </div>
      </div>`;

    // ── Size selection ────────────────────────────────────────────────────────
    document.querySelectorAll('.pp-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pp-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.dataset.size;
        const label = document.getElementById('ppSizeSelected');
        if (label) label.textContent = `— ${selectedSize}`;
        document.getElementById('ppSizeErr')?.classList.add('hidden');
        // Show stock for selected size
        const sizeStock = p.sizes_stock?.[selectedSize];
        const stockEl = document.querySelector('.pp-stock');
        if (stockEl && sizeStock !== undefined) {
          if (sizeStock === 0) { stockEl.textContent = 'Sin stock en este talle'; stockEl.className = 'pp-stock pp-stock--out'; }
          else if (sizeStock <= 5) { stockEl.textContent = `Últimas ${sizeStock} unidades en este talle`; stockEl.className = 'pp-stock pp-stock--low'; }
          else { stockEl.textContent = 'Disponible'; stockEl.className = 'pp-stock pp-stock--ok'; }
        }
      });
    });

    // ── Add to cart ───────────────────────────────────────────────────────────
    document.getElementById('ppAddCart')?.addEventListener('click', () => {
      if (p.sizes?.length && !selectedSize) {
        document.getElementById('ppSizeErr')?.classList.remove('hidden');
        document.getElementById('ppSizesList')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      const sizeStock = selectedSize && p.sizes_stock ? p.sizes_stock[selectedSize] : p.stock;
      const maxQty = sizeStock !== undefined && sizeStock > 0 ? sizeStock : (p.stock > 0 ? p.stock : undefined);
      addToCart({ id: p.id, name: p.name, price: p.price, cover: p.images?.[0]?.filename || '', size: selectedSize, maxQty });
      const btn = document.getElementById('ppAddCart');
      if (btn) {
        btn.textContent = '¡Agregado! ✓';
        btn.classList.add('added');
        setTimeout(() => { btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Agregar al carrito`; btn.classList.remove('added'); }, 2000);
      }
    });

    // ── Buy now ───────────────────────────────────────────────────────────────
    document.getElementById('ppBuyNow')?.addEventListener('click', () => {
      if (p.sizes?.length && !selectedSize) {
        document.getElementById('ppSizeErr')?.classList.remove('hidden');
        document.getElementById('ppSizesList')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      const sizeStockBuy = selectedSize && p.sizes_stock ? p.sizes_stock[selectedSize] : p.stock;
      const maxQtyBuy = sizeStockBuy !== undefined && sizeStockBuy > 0 ? sizeStockBuy : (p.stock > 0 ? p.stock : undefined);
      addToCart({ id: p.id, name: p.name, price: p.price, cover: p.images?.[0]?.filename || '', size: selectedSize, maxQty: maxQtyBuy });
      window.location.href = '/?cart=open';
    });

    // ── Favorite ──────────────────────────────────────────────────────────────
    document.getElementById('ppFavBtn')?.addEventListener('click', () => {
      const now = toggleFav(p.id);
      const btn = document.getElementById('ppFavBtn');
      btn.classList.toggle('active', now);
      btn.querySelector('svg').setAttribute('fill', now ? 'currentColor' : 'none');
      btn.childNodes[btn.childNodes.length - 1].textContent = now ? ' En favoritos' : ' Agregar a favoritos';
    });

    // ── Gallery wiring ────────────────────────────────────────────────────────
    if (images.length > 1) {
      const mainImg = document.getElementById('ppMainImg');
      const thumbEls = document.querySelectorAll('.pp-thumb');
      let current = 0;
      function goTo(idx) {
        current = (idx + images.length) % images.length;
        mainImg.src = `/img/products/${images[current].filename}`;
        thumbEls.forEach((t, i) => t.classList.toggle('active', i === current));
        thumbEls[current]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      thumbEls.forEach((btn, i) => btn.addEventListener('click', () => goTo(i)));
      document.getElementById('ppPrev')?.addEventListener('click', () => goTo(current - 1));
      document.getElementById('ppNext')?.addEventListener('click', () => goTo(current + 1));
      let touchStartX = 0;
      mainImg.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      mainImg.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
      });
    }
  }

  loadCurrencyRates().then(() => {
    loadProduct();
    initCurrencySelect();
  });
  updateCartBadge();
  // Favorites count
  (function updateFavCount() {
    const cnt = (JSON.parse(localStorage.getItem('calziani_favs') || '[]')).length;
    const el = document.getElementById('favHeaderCount');
    if (el) { el.textContent = cnt; el.classList.toggle('hidden', cnt === 0); }
  })();

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
