(() => {
  const photoCache = new Map();
  let initialized = false;

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function fetchPhotos(productId) {
    const key = productId ? `p${productId}` : 'all';
    if (photoCache.has(key)) return photoCache.get(key);

    const params = new URLSearchParams({ limit: '40' });
    if (productId) params.set('product_id', String(productId));

    const res = await fetch(`/api/customer-photos?${params}`);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    photoCache.set(key, data);
    return data;
  }

  function renderGallery(photos) {
    if (!photos.length) {
      return '<p class="trust-modal__empty">Pronto compartiremos más testimonios de nuestros clientes.</p>';
    }
    return `<div class="trust-modal__track">${photos.map(photo => `
      <figure class="trust-modal__item">
        <button type="button" class="trust-modal__photo-btn" data-photo="${escHtml(photo.filename)}" aria-label="Ver testimonio">
          <img src="/img/customer-photos/${escHtml(photo.filename)}" alt="Cliente Calziani" loading="lazy" />
        </button>
        ${photo.caption
          ? `<figcaption>${escHtml(photo.caption)}</figcaption>`
          : (photo.product_name ? `<figcaption>${escHtml(photo.product_name)}</figcaption>` : '')}
      </figure>`).join('')}</div>`;
  }

  function openPhotoLightbox(filename) {
    const overlay = document.createElement('div');
    overlay.className = 'trust-lightbox';
    overlay.innerHTML = `
      <button type="button" class="trust-lightbox__close" aria-label="Cerrar">×</button>
      <img src="/img/customer-photos/${escHtml(filename)}" alt="Cliente Calziani" />`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.trust-lightbox__close')) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function wireGallery(root) {
    root.querySelectorAll('.trust-modal__photo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.photo;
        if (filename) openPhotoLightbox(filename);
      });
    });
  }

  function closeModal() {
    const modal = document.getElementById('trustModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function openTrustModal(productId) {
    const modal = document.getElementById('trustModal');
    const gallery = document.getElementById('trustGallery');
    if (!modal || !gallery) return;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    gallery.innerHTML = '<p class="trust-modal__loading">Cargando testimonios...</p>';

    try {
      const photos = await fetchPhotos(productId);
      gallery.innerHTML = renderGallery(photos);
      wireGallery(gallery);
    } catch {
      gallery.innerHTML = '<p class="trust-modal__empty">No pudimos cargar los testimonios. Intentá nuevamente.</p>';
    }
  }

  function initTrust() {
    if (initialized) return;
    initialized = true;

    document.addEventListener('click', e => {
      const openBtn = e.target.closest('[data-trust-open]');
      if (openBtn) {
        e.preventDefault();
        const raw = openBtn.dataset.trustProductId;
        const productId = raw ? Number(raw) : undefined;
        openTrustModal(Number.isFinite(productId) && productId > 0 ? productId : undefined);
        return;
      }

      const photoBtn = e.target.closest('.trust-modal__photo-btn');
      if (photoBtn?.dataset.photo) {
        e.preventDefault();
        openPhotoLightbox(photoBtn.dataset.photo);
      }
    });

    document.getElementById('trustBackdrop')?.addEventListener('click', closeModal);
    document.getElementById('trustModalClose')?.addEventListener('click', closeModal);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('trustModal')?.classList.contains('open')) {
        closeModal();
      }
    });
  }

  window.CalzianiTrust = { init: initTrust, open: openTrustModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrust);
  } else {
    initTrust();
  }
})();
