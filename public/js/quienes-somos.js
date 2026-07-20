(() => {
  const track   = document.getElementById('qsTestimonials');
  const navWrap = document.getElementById('qsCarouselNav');
  const prevBtn = document.getElementById('qsPrev');
  const nextBtn = document.getElementById('qsNext');
  const lightbox      = document.getElementById('qsLightbox');
  const lightboxInner  = document.getElementById('qsLightboxInner');
  const lightboxClose  = document.getElementById('qsLightboxClose');

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function starRow(rating) {
    const n = Math.round(Number(rating) || 0);
    if (n < 1) return '';
    return `<div class="qs-card__stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</div>`;
  }

  function mediaMarkup(t) {
    if (!t.filename) return '';
    const src = `/img/customer-photos/${escHtml(t.filename)}`;
    if (t.media_type === 'video') {
      return `<div class="qs-card__media qs-card__media--playable" data-media="video" data-src="${src}">
        <video src="${src}" muted playsinline preload="metadata"></video>
        <span class="qs-card__play" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="#FCFBF9"><circle cx="12" cy="12" r="11" fill="rgba(21,23,22,0.35)"/><path d="M10 8.5v7l6-3.5-6-3.5z"/></svg>
        </span>
      </div>`;
    }
    if (t.media_type === 'audio') {
      return `<div class="qs-card__audio">
        <span class="qs-card__audio-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </span>
        <audio src="${src}" controls preload="none"></audio>
      </div>`;
    }
    return `<div class="qs-card__media qs-card__media--playable" data-media="image" data-src="${src}">
      <img src="${src}" alt="Cliente Calziani" loading="lazy" />
    </div>`;
  }

  function cardMarkup(t) {
    const text = t.review_text || t.caption || '';
    const metaBits = [`<strong>${escHtml(t.reviewer_name)}</strong>`];
    if (t.product_name) metaBits.push(`compró ${escHtml(t.product_name)}`);

    return `<article class="qs-card">
      ${mediaMarkup(t)}
      <div class="qs-card__body">
        ${starRow(t.rating)}
        ${text ? `<p class="qs-card__text">${escHtml(text)}</p>` : ''}
        <p class="qs-card__meta">${metaBits.join(' — ')}</p>
      </div>
    </article>`;
  }

  function openLightbox(mediaType, src) {
    lightboxInner.innerHTML = mediaType === 'video'
      ? `<video src="${src}" controls autoplay playsinline></video>`
      : `<img src="${src}" alt="Cliente Calziani" />`;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxInner.innerHTML = '';
  }

  async function loadTestimonials() {
    try {
      const res = await fetch('/api/testimonials?limit=40');
      if (!res.ok) throw new Error('fetch failed');
      const rows = await res.json();

      if (!Array.isArray(rows) || !rows.length) {
        track.hidden = true;
        return;
      }

      track.innerHTML = rows.map(cardMarkup).join('');

      if (rows.length > 1 && navWrap) navWrap.hidden = false;

      track.querySelectorAll('[data-media]').forEach(el => {
        el.addEventListener('click', () => openLightbox(el.dataset.media, el.dataset.src));
      });
    } catch (e) {
      track.hidden = true;
    }
  }

  prevBtn?.addEventListener('click', () => track.scrollBy({ left: -320, behavior: 'smooth' }));
  nextBtn?.addEventListener('click', () => track.scrollBy({ left: 320, behavior: 'smooth' }));

  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox?.classList.contains('open')) closeLightbox();
  });

  loadTestimonials();
})();
