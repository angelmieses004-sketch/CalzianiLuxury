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

  // Equivalente en pesos dominicanos (moneda de cobro vía AZUL)
  function formatDop(priceUSD) {
    const converted = priceUSD * (currencyRates.DOP || 59.48);
    return 'RD$' + new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(converted);
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
    if (stock > 0 && stock < 5)  return { text: 'Quedan pocas unidades', cls: 'low' };
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
    console.log('[product.js] addToCart llamado →', productData.name);
    if (window.CalzianiPixel) {
      window.CalzianiPixel.trackAddToCart({
        id:    productData.id,
        name:  productData.name,
        price: productData.price,
      });
    } else {
      console.warn('[product.js] CalzianiPixel no disponible — AddToCart no se disparó');
    }
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
  let stockBySize = null;
  let offerCountdownTimer = null;
  let selectedReviewRating = 0;
  let reviewModalReady = false;
  let reviewPhotoObjectUrl = null;

  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    let html = '<span class="pp-reviews-stars__icons" aria-hidden="true">';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(r);
      html += `<span class="${filled ? '' : 'pp-star--empty'}">★</span>`;
    }
    html += '</span>';
    return html;
  }

  function formatReviewDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
    } catch { return ''; }
  }

  function msUntilMidnightRD() {
    const now = Date.now();
    const utc = now + new Date().getTimezoneOffset() * 60000;
    const rd = new Date(utc - 4 * 3600000);
    const nextMidnightUtc = Date.UTC(rd.getFullYear(), rd.getMonth(), rd.getDate() + 1, 4, 0, 0);
    return Math.max(0, nextMidnightUtc - now);
  }

  function formatCountdown(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  function clearOfferCountdown() {
    if (offerCountdownTimer) {
      clearInterval(offerCountdownTimer);
      offerCountdownTimer = null;
    }
  }

  function initOfferCountdown() {
    clearOfferCountdown();
    const el = document.getElementById('ppOfferCountdown');
    if (!el) return;
    el.hidden = false;
    const tick = () => {
      const ms = msUntilMidnightRD();
      el.textContent = ms <= 0
        ? '🕐 Precio especial termina pronto'
        : `🕐 Precio especial termina en ${formatCountdown(ms)}`;
    };
    tick();
    offerCountdownTimer = setInterval(tick, 1000);
    const pageEl = document.getElementById('productPage');
    if (pageEl) {
      const mo = new MutationObserver(() => {
        if (!document.getElementById('ppOfferCountdown')) {
          clearOfferCountdown();
          mo.disconnect();
        }
      });
      mo.observe(pageEl, { childList: true, subtree: true });
    }
  }

  async function fetchProductStock(productId) {
    if (stockBySize) return stockBySize;
    try {
      const res = await fetch(`/api/products/${productId}/stock`);
      if (!res.ok) return {};
      const data = await res.json();
      stockBySize = data.by_size || {};
      return stockBySize;
    } catch {
      return {};
    }
  }

  async function updateSizeUrgency(productId, size) {
    const el = document.getElementById('ppSizeUrgency');
    if (!el) return;
    if (!size) {
      el.classList.add('hidden');
      return;
    }
    const bySize = await fetchProductStock(productId);
    const n = Number(bySize[size]);
    if (Number.isFinite(n) && n > 0 && n <= 3) {
      el.textContent = `⚡ Solo quedan ${n} en talla ${size}`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function clearReviewPhoto() {
    if (reviewPhotoObjectUrl) {
      URL.revokeObjectURL(reviewPhotoObjectUrl);
      reviewPhotoObjectUrl = null;
    }
    const input = document.getElementById('reviewPhoto');
    const preview = document.getElementById('reviewPhotoPreview');
    const img = document.getElementById('reviewPhotoImg');
    if (input) input.value = '';
    if (img) img.removeAttribute('src');
    preview?.classList.add('hidden');
  }

  function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
  }

  function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.getElementById('reviewFormErr')?.classList.add('hidden');
    clearReviewPhoto();
  }

  function setReviewStars(rating) {
    selectedReviewRating = rating;
    document.querySelectorAll('.pp-review-star').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.rating) <= rating);
    });
  }

  function setupReviewModalOnce() {
    if (reviewModalReady) return;
    reviewModalReady = true;

    page?.addEventListener('click', (e) => {
      if (e.target.closest('[data-review-open]')) openReviewModal();
    });
    document.getElementById('reviewBackdrop')?.addEventListener('click', closeReviewModal);
    document.getElementById('reviewModalClose')?.addEventListener('click', closeReviewModal);

    document.querySelectorAll('.pp-review-star').forEach(btn => {
      btn.addEventListener('click', () => setReviewStars(Number(btn.dataset.rating)));
    });

    document.getElementById('reviewPhoto')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      const errEl = document.getElementById('reviewFormErr');
      errEl?.classList.add('hidden');
      if (reviewPhotoObjectUrl) {
        URL.revokeObjectURL(reviewPhotoObjectUrl);
        reviewPhotoObjectUrl = null;
      }
      const preview = document.getElementById('reviewPhotoPreview');
      const img = document.getElementById('reviewPhotoImg');
      if (!file) {
        if (img) img.removeAttribute('src');
        preview?.classList.add('hidden');
        return;
      }
      if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
        if (errEl) { errEl.textContent = 'Formato no válido. Usá JPG, PNG o WEBP.'; errEl.classList.remove('hidden'); }
        e.target.value = '';
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        if (errEl) { errEl.textContent = 'La imagen no puede superar 8 MB.'; errEl.classList.remove('hidden'); }
        e.target.value = '';
        return;
      }
      reviewPhotoObjectUrl = URL.createObjectURL(file);
      if (img) img.src = reviewPhotoObjectUrl;
      preview?.classList.remove('hidden');
    });

    document.getElementById('reviewPhotoRemove')?.addEventListener('click', clearReviewPhoto);

    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data?.user?.name) {
          const nameInput = document.getElementById('reviewName');
          if (nameInput) {
            nameInput.value = data.user.name;
            nameInput.readOnly = true;
          }
        }
      })
      .catch(() => {});

    document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('reviewFormErr');
      const submitBtn = document.getElementById('reviewSubmitBtn');
      const review_text = document.getElementById('reviewText')?.value?.trim() || '';
      const name = document.getElementById('reviewName')?.value?.trim() || '';

      errEl?.classList.add('hidden');
      if (!selectedReviewRating) {
        if (errEl) { errEl.textContent = 'Seleccioná una calificación.'; errEl.classList.remove('hidden'); }
        return;
      }
      if (review_text.length < 10) {
        if (errEl) { errEl.textContent = 'La reseña debe tener al menos 10 caracteres.'; errEl.classList.remove('hidden'); }
        return;
      }
      if (!name) {
        if (errEl) { errEl.textContent = 'Ingresá tu nombre.'; errEl.classList.remove('hidden'); }
        return;
      }

      submitBtn.disabled = true;
      try {
        const photoFile = document.getElementById('reviewPhoto')?.files?.[0];
        let res;
        if (photoFile) {
          const fd = new FormData();
          fd.append('rating', String(selectedReviewRating));
          fd.append('review_text', review_text);
          fd.append('name', name);
          fd.append('image', photoFile);
          res = await fetch(`/api/products/${id}/reviews`, { method: 'POST', body: fd });
        } else {
          res = await fetch(`/api/products/${id}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: selectedReviewRating, review_text, name }),
          });
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo publicar la reseña.');
        document.getElementById('reviewForm')?.reset();
        setReviewStars(0);
        clearReviewPhoto();
        closeReviewModal();
        await loadProductReviews(id);
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  async function loadProductReviews(productId) {
    const summaryEl = document.getElementById('ppReviewsSummary');
    const sectionEl = document.getElementById('ppReviewsSection');
    const listEl = document.getElementById('ppReviewsList');
    if (!summaryEl) return;

    try {
      const data = await (await fetch(`/api/products/${productId}/reviews`)).json();
      const count = Number(data.count) || 0;
      const avg = Number(data.avg_rating) || 0;

      if (count > 0 && avg > 0) {
        summaryEl.innerHTML = `
          <div class="pp-reviews-stars">
            ${renderStars(avg)}
            <span class="pp-reviews-count">(${count} reseña${count !== 1 ? 's' : ''})</span>
          </div>`;
      } else {
        summaryEl.innerHTML = `<p class="pp-reviews-empty">Sé el primero en <button type="button" class="pp-reviews-first" data-review-open>opinar</button></p>`;
      }

      if (sectionEl && listEl) {
        if (data.reviews?.length) {
          listEl.innerHTML = data.reviews.map(r => `
            <article class="pp-review-card">
              <div class="pp-review-card__head">
                <span class="pp-review-card__name">${escHtml(r.reviewer_name || 'Cliente')}</span>
                <span class="pp-review-card__date">${formatReviewDate(r.created_at)}</span>
              </div>
              ${r.rating ? `<div class="pp-reviews-stars">${renderStars(r.rating)}</div>` : ''}
              <p class="pp-review-card__text">${escHtml(r.review_text || '')}</p>
              ${r.photo ? `<div class="pp-review-card__photo"><img src="/img/customer-photos/${escHtml(r.photo)}" alt="Foto de compra de ${escHtml(r.reviewer_name || 'cliente')}" loading="lazy" /></div>` : ''}
            </article>`).join('');
          sectionEl.hidden = false;
        } else {
          sectionEl.hidden = true;
          listEl.innerHTML = '';
        }
      }
    } catch { /* ignore */ }
  }

  function aggregateStock(prod) {
    if (prod.sizes?.length && prod.sizes_stock) {
      return prod.sizes.reduce((sum, sz) => sum + (Number(prod.sizes_stock[sz]) || 0), 0);
    }
    return Number(prod.stock) || 0;
  }

  function renderRelatedCard(item) {
    const isOffer = item.compare_price && item.compare_price > item.price;
    const imgHtml = item.cover
      ? `<img src="/img/products/${escHtml(item.cover)}" alt="${escHtml(item.name)}" class="pp-related-card__img" loading="lazy" />`
      : `<div class="pp-related-card__empty">CALZIANI</div>`;
    const priceHtml = isOffer
      ? `<span class="pp-related-card__price pp-related-card__price--sale">${formatPrice(item.price)}</span>
         <span class="pp-related-card__orig">${formatPrice(item.compare_price)}</span>`
      : `<span class="pp-related-card__price">${formatPrice(item.price)}</span>`;
    return `<a class="pp-related-card" href="/product/${item.id}">
      <div class="pp-related-card__media">
        ${imgHtml}
      </div>
      <div class="pp-related-card__info">
        <p class="pp-related-card__cat">${CATEGORY_LABELS[item.category] || item.category}</p>
        <h3 class="pp-related-card__name">${escHtml(item.name)}</h3>
        <div class="pp-related-card__pricing">${priceHtml}</div>
      </div>
    </a>`;
  }

  async function loadRelatedProducts(productId) {
    const section = document.getElementById('ppRelated');
    const grid = document.getElementById('ppRelatedGrid');
    if (!section || !grid) return;

    try {
      const res = await fetch(`/api/products/${productId}/related?limit=8`);
      if (!res.ok) return;
      const items = await res.json();
      const inStock = items.filter(i => aggregateStock(i) > 0);
      const list = (inStock.length ? inStock : items).slice(0, 8);
      if (!list.length) return;

      grid.innerHTML = list.map(renderRelatedCard).join('');
      section.hidden = false;
    } catch { /* ignore */ }
  }

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('not found');
      product = await res.json();
      render(product);
      updateCartBadge();
      console.log('[product.js] producto cargado →', product.name);
      if (window.CalzianiPixel) {
        window.CalzianiPixel.trackViewContent({ id: product.id, name: product.name, price: product.price });
      } else {
        console.warn('[product.js] CalzianiPixel no disponible — ViewContent no se disparó');
      }
    } catch {
      page.innerHTML = `
        <div class="pp-error">
          <p>Producto no encontrado.</p>
          <a href="/" class="pp-back-link">← Volver a la tienda</a>
        </div>`;
    }
  }

  function render(p) {
    clearOfferCountdown();
    stockBySize = null;
    selectedSize = '';
    const isOffer  = p.compare_price && p.compare_price > p.price;
    const discount = isOffer ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
    const sl       = stockLabel(p.stock);
    const images   = p.images || [];
    const fav      = isFav(p.id);

    // ── SEO dinámico ─────────────────────────────────────────────────────────
    const BASE = 'https://calziani.com';
    const productUrl  = `${BASE}/product/${p.id}`;
    const imageUrl    = p.images?.[0]?.filename
      ? `${BASE}/img/products/${p.images[0].filename}`
      : `${BASE}/img/587730407_17843809347618797_3290323688225420457_n.jpg`;
    const catLabel    = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' }[p.category] || p.category;
    const priceUSD    = Number(p.price).toFixed(2);
    const metaDesc    = p.description
      ? `${p.description.slice(0, 130).trim()}… | Calziani`
      : `Comprá ${p.name} en Calziani. ${catLabel} de lujo con envío mundial. Precio: $${priceUSD} USD.`;

    document.title = `${p.name} — Calziani | ${catLabel} Luxury`;
    document.getElementById('canonicalTag')?.setAttribute('href', productUrl);

    // Open Graph
    document.getElementById('ogTitle')?.setAttribute('content', `${p.name} — Calziani`);
    document.getElementById('ogDesc')?.setAttribute('content', metaDesc);
    document.getElementById('ogUrl')?.setAttribute('content', productUrl);
    document.getElementById('ogImage')?.setAttribute('content', imageUrl);
    document.getElementById('ogImageAlt')?.setAttribute('content', p.name);
    document.getElementById('ogPrice')?.setAttribute('content', priceUSD);

    // Twitter Card
    document.getElementById('twTitle')?.setAttribute('content', `${p.name} — Calziani`);
    document.getElementById('twDesc')?.setAttribute('content', metaDesc);
    document.getElementById('twImage')?.setAttribute('content', imageUrl);

    // Meta description
    let metaDescEl = document.querySelector('meta[name="description"]');
    if (!metaDescEl) { metaDescEl = document.createElement('meta'); metaDescEl.name = 'description'; document.head.appendChild(metaDescEl); }
    metaDescEl.setAttribute('content', metaDesc);

    // JSON-LD Product
    const availability = p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          "@id": productUrl,
          "name": p.name,
          "description": p.description || `${p.name} — ${catLabel} de lujo disponible en Calziani.`,
          "url": productUrl,
          "image": p.images?.map(img => `${BASE}/img/products/${img.filename}`) || [imageUrl],
          "brand": { "@type": "Brand", "name": "Calziani" },
          "category": catLabel,
          "sku": `CLZ-${p.id}`,
          "offers": {
            "@type": "Offer",
            "url": productUrl,
            "priceCurrency": "USD",
            "price": priceUSD,
            "availability": availability,
            "seller": { "@type": "Organization", "name": "Calziani" },
            "shippingDetails": {
              "@type": "OfferShippingDetails",
              "shippingDestination": { "@type": "DefinedRegion", "addressCountry": ["DO", "US", "PR", "ES"] }
            }
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Inicio", "item": BASE },
            { "@type": "ListItem", "position": 2, "name": catLabel, "item": `${BASE}/?category=${p.category}` },
            { "@type": "ListItem", "position": 3, "name": p.name, "item": productUrl }
          ]
        }
      ]
    };
    const ldEl = document.getElementById('productJsonLd');
    if (ldEl) ldEl.textContent = JSON.stringify(jsonLd);

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
    const dopRefHtml = activeCurrency !== 'DOP'
      ? `<span class="pp-price-dop" id="ppPriceDop">≈ ${formatDop(p.price)} DOP</span>`
      : '';
    const priceHtml = isOffer
      ? `<div class="pp-pricing">
           <span class="pp-badge-offer">−${discount}% OFERTA</span>
           <span class="pp-price pp-price--sale">${formatPrice(p.price)}</span>
           <span class="pp-price-orig">${formatPrice(p.compare_price)}</span>
           ${dopRefHtml}
           <p class="pp-offer-countdown" id="ppOfferCountdown" hidden></p>
         </div>`
      : `<div class="pp-pricing"><span class="pp-price">${formatPrice(p.price)}</span>${dopRefHtml}</div>`;

    // ── Sizes HTML (selectable) ───────────────────────────────────────────────
    const sizesHtml = p.sizes && p.sizes.length
      ? `<div class="pp-sizes">
           <p class="pp-label">Talle <span class="pp-size-selected" id="ppSizeSelected"></span></p>
           <div class="pp-sizes-list" id="ppSizesList">
             ${p.sizes.map(s => `<button class="pp-size-tag pp-size-btn" data-size="${escHtml(s)}" type="button">${escHtml(s)}</button>`).join('')}
           </div>
           <p class="pp-size-urgency hidden" id="ppSizeUrgency"></p>
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

    const trustTeaserHtml = `
      <button type="button" class="trust-teaser__link" data-trust-open data-trust-product-id="${p.id}">
        ¿Cómo confiar en nosotros?
      </button>`;

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

    const returnsHtml = `
      <div class="pp-returns">
        <p class="pp-returns__title">Devoluciones fáciles</p>
        <p class="pp-returns__text">
          Si hay algún problema con tu pedido, te ayudamos a resolverlo de forma sencilla.
          <button type="button" class="pp-returns__link" id="ppReturnsLink">Ver política de devoluciones</button>
        </p>
      </div>`;

    const trustHtml = `
      <div class="pp-trust">
        <div class="pp-trust__item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>100% Autenticidad garantizada</span>
        </div>
        <div class="pp-trust__item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="m16 8 5 0 2 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span>Envío mundial disponible</span>
        </div>
        <div class="pp-trust__item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/></svg>
          <span>Atención personalizada 24/7</span>
        </div>
      </div>`;

    page.innerHTML = `
      <div class="pp-container">
        <a href="/" class="pp-back">← Volver</a>
        <div class="pp-layout">
          ${galleryHtml}
          <div class="pp-info">
            <p class="pp-category">${CATEGORY_LABELS[p.category] || p.category}</p>
            <h1 class="pp-name">${escHtml(p.name)}</h1>
            <div class="pp-reviews-summary" id="ppReviewsSummary"></div>
            ${priceHtml}
            ${shipHtml}
            ${stockHtml}
            ${sizesHtml}
            ${trustTeaserHtml}
            ${ctaHtml}
            ${returnsHtml}
            ${trustHtml}
            ${p.description ? `<div class="pp-desc"><p class="pp-label">Descripción</p><p>${escHtml(p.description)}</p></div>` : ''}
          </div>
        </div>
        <section class="pp-reviews-section" id="ppReviewsSection" aria-label="Reseñas de clientes" hidden>
          <h2 class="pp-reviews-section__title">Opiniones de clientes</h2>
          <div class="pp-reviews-list" id="ppReviewsList"></div>
          <button type="button" class="pp-reviews-write" data-review-open>Escribir reseña</button>
        </section>
        <section class="pp-related" id="ppRelated" aria-label="Te podría gustar" hidden>
          <h2 class="pp-related__title">Te podría gustar</h2>
          <div class="pp-related__grid" id="ppRelatedGrid"></div>
        </section>
      </div>`;

    // ── Returns policy modal ───────────────────────────────────────────────────
    const returnsModal = document.getElementById('returnsModal');
    const openReturns = () => {
      returnsModal?.classList.add('open');
      returnsModal?.setAttribute('aria-hidden', 'false');
    };
    const closeReturns = () => {
      returnsModal?.classList.remove('open');
      returnsModal?.setAttribute('aria-hidden', 'true');
    };
    document.getElementById('ppReturnsLink')?.addEventListener('click', openReturns);
    document.getElementById('returnsBackdrop')?.addEventListener('click', closeReturns);
    document.getElementById('returnsModalClose')?.addEventListener('click', closeReturns);

      loadRelatedProducts(p.id);
      loadProductReviews(p.id);
      if (isOffer) initOfferCountdown();
      fetchProductStock(p.id);

    // ── Size selection ────────────────────────────────────────────────────────
    document.querySelectorAll('.pp-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pp-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.dataset.size;
        const label = document.getElementById('ppSizeSelected');
        if (label) label.textContent = `— ${selectedSize}`;
        document.getElementById('ppSizeErr')?.classList.add('hidden');
        updateSizeUrgency(p.id, selectedSize);
        // Show stock for selected size
        const sizeStock = p.sizes_stock?.[selectedSize];
        const stockEl = document.querySelector('.pp-stock');
        if (stockEl && sizeStock !== undefined) {
          if (sizeStock === 0) { stockEl.textContent = 'Sin stock en este talle'; stockEl.className = 'pp-stock pp-stock--out'; }
          else if (sizeStock > 0 && sizeStock < 5) { stockEl.textContent = 'Quedan pocas unidades'; stockEl.className = 'pp-stock pp-stock--low'; }
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
    setupReviewModalOnce();
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
