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

  function mediaTypeOf(photo) {
    if (photo.media_type) return photo.media_type;
    const ext = String(photo.filename || '').split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
    if (['mp3', 'm4a', 'wav'].includes(ext)) return 'audio';
    return 'image';
  }

  function renderGallery(photos) {
    if (!photos.length) {
      return '<p class="trust-modal__empty">Pronto compartiremos más testimonios de nuestros clientes.</p>';
    }
    return `<div class="trust-modal__track">${photos.map(photo => {
      const type = mediaTypeOf(photo);
      const src  = `/img/customer-photos/${escHtml(photo.filename)}`;
      const media = type === 'audio'
        ? `<div class="trust-modal__audio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <audio src="${src}" controls preload="none"></audio>
          </div>`
        : `<button type="button" class="trust-modal__photo-btn" data-photo="${escHtml(photo.filename)}" data-type="${type}" aria-label="Ver testimonio">
            <div class="trust-modal__media-wrap">
              ${type === 'video'
                ? `<video src="${src}" muted playsinline preload="metadata"></video>`
                : `<img src="${src}" alt="Cliente Calziani" loading="lazy" />`}
              ${type === 'video' ? `<span class="trust-modal__play"><svg width="34" height="34" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.35)"/><path d="M10 8.5v7l6-3.5-6-3.5z"/></svg></span>` : ''}
            </div>
          </button>`;
      return `<figure class="trust-modal__item">
        ${media}
        ${photo.caption
          ? `<figcaption>${escHtml(photo.caption)}</figcaption>`
          : (photo.product_name ? `<figcaption>${escHtml(photo.product_name)}</figcaption>` : '')}
      </figure>`;
    }).join('')}</div>`;
  }

  function openPhotoLightbox(filename, type) {
    const overlay = document.createElement('div');
    overlay.className = 'trust-lightbox';
    const src = `/img/customer-photos/${escHtml(filename)}`;
    overlay.innerHTML = `
      <button type="button" class="trust-lightbox__close" aria-label="Cerrar">×</button>
      ${type === 'video'
        ? `<video src="${src}" controls autoplay playsinline></video>`
        : `<img src="${src}" alt="Cliente Calziani" />`}`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.trust-lightbox__close')) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function wireGallery(root) {
    root.querySelectorAll('.trust-modal__photo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.photo;
        if (filename) openPhotoLightbox(filename, btn.dataset.type);
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
