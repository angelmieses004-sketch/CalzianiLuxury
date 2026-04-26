(() => {
  const CATEGORY_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };

  function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price);
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

  const page = document.getElementById('productPage');
  const id   = location.pathname.split('/').pop();

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('not found');
      const p  = await res.json();
      render(p);
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

    // ── Sizes HTML ────────────────────────────────────────────────────────────
    const sizesHtml = p.sizes && p.sizes.length
      ? `<div class="pp-sizes">
           <p class="pp-label">Talles disponibles</p>
           <div class="pp-sizes-list">${p.sizes.map(s => `<span class="pp-size-tag">${s}</span>`).join('')}</div>
         </div>`
      : '';

    // ── Shipping HTML ─────────────────────────────────────────────────────────
    const shipHtml = p.shipping_days
      ? `<div class="pp-ship">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="m16 8 5 0 2 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
           Envío: ${escHtml(p.shipping_days)}
         </div>`
      : '';

    // ── Stock HTML ────────────────────────────────────────────────────────────
    const stockHtml = `<p class="pp-stock pp-stock--${sl.cls || 'ok'}">${sl.text}</p>`;

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
            ${p.description ? `<div class="pp-desc"><p class="pp-label">Descripción</p><p>${escHtml(p.description)}</p></div>` : ''}
          </div>
        </div>
      </div>`;

    // ── Gallery wiring ────────────────────────────────────────────────────────
    if (images.length > 1) {
      const mainImg  = document.getElementById('ppMainImg');
      const thumbs   = document.querySelectorAll('.pp-thumb');
      let current    = 0;

      function goTo(idx) {
        current = (idx + images.length) % images.length;
        mainImg.src = `/img/products/${images[current].filename}`;
        thumbs.forEach((t, i) => t.classList.toggle('active', i === current));
        // scroll thumb into view
        thumbs[current]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      thumbs.forEach((btn, i) => btn.addEventListener('click', () => goTo(i)));
      document.getElementById('ppPrev')?.addEventListener('click', () => goTo(current - 1));
      document.getElementById('ppNext')?.addEventListener('click', () => goTo(current + 1));

      // Swipe on mobile
      let touchStartX = 0;
      mainImg.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      mainImg.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
      });
    }
  }

  loadProduct();
})();
