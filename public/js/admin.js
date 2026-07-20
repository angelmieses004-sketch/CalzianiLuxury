(() => {
  // ─── State ─────────────────────────────────────────────────────────────────
  let token = sessionStorage.getItem('calziani_token') || null;
  let pendingDeleteId = null;
  let searchTimer = null;

  const CAT_LABELS = { calzado: 'Calzado' };

  const ORDER_STATUS_LABEL = {
    pending_transfer: 'Pendiente (transferencia / WhatsApp)',
    pending_azul: 'Pendiente (tarjeta AZUL)',
    pending_paypal: 'Pendiente (PayPal)',
    paid_paypal: 'Pagado (PayPal)',
    paid: 'Pagado',
    cancelled: 'Cancelado',
    pending_paypalme: 'Pendiente (PayPal.me)',
    manual: 'Creado manualmente',
  };

  const TRACKING_STAGE_LABEL = {
    received:             '📦 Pedido recibido',
    in_europe:            '✈️ En Europa',
    in_usa:               '🇺🇸 En EE.UU.',
    in_dominican_republic:'🇩🇴 En Rep. Dominicana',
    delivered:            '✅ Entregado',
  };
  const TRACKING_STAGES = ['received', 'in_europe', 'in_usa', 'in_dominican_republic', 'delivered'];

  const SIZES_BY_CATEGORY = {
    calzado:   ['35','36','37','38','39','40','41','42','43','44','45'],
  };

  // ─── DOM refs ───────────────────────────────────────────────────────────────
  const loginScreen    = document.getElementById('loginScreen');
  const adminPanel     = document.getElementById('adminPanel');
  const loginForm      = document.getElementById('loginForm');
  const loginError     = document.getElementById('loginError');
  const logoutBtn      = document.getElementById('logoutBtn');

  const sidebarLinks   = document.querySelectorAll('.sidebar__link');
  const views          = document.querySelectorAll('.view');

  const adminSearch    = document.getElementById('adminSearch');
  const adminCatFilter = document.getElementById('adminCatFilter');
  const adminList      = document.getElementById('adminProductList');
  const ordersList     = document.getElementById('ordersList');

  const productForm    = document.getElementById('productForm');
  const formTitle      = document.getElementById('formTitle');
  const editId         = document.getElementById('editId');
  const fName          = document.getElementById('fName');
  const fCategory      = document.getElementById('fCategory');
  const fPrice         = document.getElementById('fPrice');
  const fDesc          = document.getElementById('fDesc');
  const formError          = document.getElementById('formError');
  const formSubmitBtn      = document.getElementById('formSubmitBtn');
  const formCancelBtn      = document.getElementById('formCancelBtn');
  const sizesContainer     = document.getElementById('sizesContainer');
  const sizesHint          = document.getElementById('sizesHint');
  const fComparePrice      = document.getElementById('fComparePrice');
  const fShipping          = document.getElementById('fShipping');
  const fHot               = document.getElementById('fHot');
  const fLowStock          = document.getElementById('fLowStock');
  const offerBadgePreview  = document.getElementById('offerBadgePreview');
  const fImages            = document.getElementById('fImages');
  const imgGrid            = document.getElementById('imgGrid');

  const passwordForm   = document.getElementById('passwordForm');
  const newPass        = document.getElementById('newPass');
  const confirmPass    = document.getElementById('confirmPass');
  const passError      = document.getElementById('passError');

  const deleteModal      = document.getElementById('deleteModal');
  const deleteBackdrop   = document.getElementById('deleteBackdrop');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn  = document.getElementById('cancelDeleteBtn');

  const toast = document.getElementById('toast');

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatPrice(p) {
    return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(p);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function customerMediaType(row) {
    if (row.media_type) return row.media_type;
    const ext = String(row.filename || '').split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
    if (['mp3', 'm4a', 'wav'].includes(ext)) return 'audio';
    return 'image';
  }

  function customerMediaMarkup(row, cls) {
    const src = `/img/customer-photos/${escHtml(row.filename)}`;
    const type = customerMediaType(row);
    if (type === 'video') return `<video src="${src}" class="${cls}" controls></video>`;
    if (type === 'audio') return `<audio src="${src}" class="${cls}" controls></audio>`;
    return `<img src="${src}" alt="Cliente" class="${cls}" />`;
  }

  function renderAdminPagination(page, pages, section) {
    if (!pages || pages <= 1) return '';
    const prev = page > 1
      ? `<button class="admin-page-btn" data-section="${section}" data-page="${page - 1}">&#8592; Anterior</button>`
      : `<button class="admin-page-btn" disabled>&#8592; Anterior</button>`;
    const next = page < pages
      ? `<button class="admin-page-btn" data-section="${section}" data-page="${page + 1}">Siguiente &#8594;</button>`
      : `<button class="admin-page-btn" disabled>Siguiente &#8594;</button>`;
    return `<div class="admin-pagination">${prev}<span class="admin-page-info">Página ${page} de ${pages}</span>${next}</div>`;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.admin-page-btn[data-section]');
    if (!btn) return;
    const p = Number(btn.dataset.page);
    if (btn.dataset.section === 'products') loadProducts(p);
    if (btn.dataset.section === 'orders')   loadOrders(p);
  });

  let toastTimer = null;
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.classList.toggle('toast-error', isError);
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
  function hideError(el) { el.classList.add('hidden'); }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-token': token };
  }

  // ─── Size + stock inputs ────────────────────────────────────────────────────
  function renderSizeStockInputs(category, selected = [], stockMap = {}) {
    const sizes = SIZES_BY_CATEGORY[category];
    if (!sizes) {
      sizesContainer.innerHTML = '';
      sizesHint.classList.remove('hidden');
      return;
    }
    sizesHint.classList.add('hidden');
    sizesContainer.innerHTML = sizes.map(s => {
      const checked = selected.includes(s) ? 'checked' : '';
      const qty = stockMap[s] ?? '';
      return `<label class="size-stock-row">
        <input type="checkbox" class="size-cb" value="${s}" ${checked} />
        <span class="size-stock-label">${s}</span>
        <input type="number" class="size-stock-qty" data-size="${s}" value="${qty}" min="0" step="1" placeholder="0" ${checked ? '' : 'disabled'} />
        <span class="size-stock-unit">uds</span>
      </label>`;
    }).join('');

    // Toggle qty input enabled/disabled based on checkbox
    sizesContainer.querySelectorAll('.size-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const qtyInput = sizesContainer.querySelector(`.size-stock-qty[data-size="${cb.value}"]`);
        if (qtyInput) {
          qtyInput.disabled = !cb.checked;
          if (!cb.checked) qtyInput.value = '';
        }
      });
    });
  }

  function getSelectedSizes() {
    return [...sizesContainer.querySelectorAll('.size-cb:checked')].map(cb => cb.value);
  }

  function getSizesStock() {
    const result = {};
    sizesContainer.querySelectorAll('.size-cb:checked').forEach(cb => {
      const qtyInput = sizesContainer.querySelector(`.size-stock-qty[data-size="${cb.value}"]`);
      result[cb.value] = Number(qtyInput?.value) || 0;
    });
    return result;
  }

  fCategory.addEventListener('change', () => {
    renderSizeStockInputs(fCategory.value, [], {});
  });

  document.getElementById('btnMarkSoldOut')?.addEventListener('click', () => {
    const inputs = sizesContainer.querySelectorAll('.size-stock-qty');
    if (!inputs.length) {
      showToast('Elegí categoría y talles en el formulario primero.', true);
      return;
    }
    let any = false;
    inputs.forEach(inp => {
      if (!inp.disabled) {
        inp.value = '0';
        any = true;
      }
    });
    if (any) showToast('Stock puesto en 0. Guardá el producto para aplicar.');
    else showToast('No hay campos de stock editables.', true);
  });

  // ─── Multi-image management ─────────────────────────────────────────────────
  // existingImages: [{id, filename}] — from server (edit mode)
  // newFiles: [File] — staged for upload
  // removeIds: [id] — existing images to delete on save

  let existingImages = [];
  let newFiles = [];
  let removeIds = [];

  function renderImgGrid() {
    imgGrid.innerHTML = '';

    // Existing images
    existingImages.forEach(img => {
      const div = document.createElement('div');
      div.className = 'img-thumb';
      div.innerHTML = `
        <img src="/img/products/${img.filename}" alt="" />
        <button type="button" class="img-thumb__remove" data-existing="${img.id}" title="Quitar">&times;</button>
      `;
      div.querySelector('.img-thumb__remove').addEventListener('click', () => {
        removeIds.push(img.id);
        existingImages = existingImages.filter(i => i.id !== img.id);
        renderImgGrid();
      });
      imgGrid.appendChild(div);
    });

    // New staged files
    newFiles.forEach((file, idx) => {
      const div = document.createElement('div');
      div.className = 'img-thumb img-thumb--new';
      const url = URL.createObjectURL(file);
      div.innerHTML = `
        <img src="${url}" alt="" />
        <span class="img-thumb__badge">Nueva</span>
        <button type="button" class="img-thumb__remove" title="Quitar">&times;</button>
      `;
      div.querySelector('.img-thumb__remove').addEventListener('click', () => {
        newFiles.splice(idx, 1);
        renderImgGrid();
      });
      imgGrid.appendChild(div);
    });
  }

  function resetImages() {
    existingImages = [];
    newFiles = [];
    removeIds = [];
    fImages.value = '';
    imgGrid.innerHTML = '';
  }

  fImages.addEventListener('change', () => {
    const files = Array.from(fImages.files);
    newFiles = [...newFiles, ...files];
    fImages.value = ''; // reset so same file can be added again
    renderImgGrid();
  });

  // Show/hide offer badge preview based on compare price vs price
  function updateOfferPreview() {
    const sale = Number(fPrice.value);
    const orig = Number(fComparePrice.value);
    const isOffer = orig > 0 && orig > sale;
    offerBadgePreview.classList.toggle('visible', isOffer);
  }
  fPrice.addEventListener('input', updateOfferPreview);
  fComparePrice.addEventListener('input', updateOfferPreview);

  // ─── Auth ───────────────────────────────────────────────────────────────────
  function checkAuth() {
    if (token) {
      loginScreen.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadProducts();
    }
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(loginError);
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!username || !password) { showError(loginError, 'Completá todos los campos.'); return; }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { showError(loginError, data.error || 'Error al iniciar sesión.'); return; }
      token = data.token;
      sessionStorage.setItem('calziani_token', token);
      loginScreen.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadProducts();
    } catch {
      showError(loginError, 'Error de conexión.');
    }
  });

  logoutBtn.addEventListener('click', () => {
    token = null;
    sessionStorage.removeItem('calziani_token');
    adminPanel.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
  });

  // ─── Navigation ─────────────────────────────────────────────────────────────
  function switchView(name) {
    views.forEach(v => v.classList.toggle('active', v.id === `view${capitalize(name)}`));
    sidebarLinks.forEach(l => l.classList.toggle('active', l.dataset.view === name));
    if (name === 'products') loadProducts();
    if (name === 'orders')   loadOrders();
    if (name === 'promos')   { loadPromos(); loadBrandPromoRules(); }
    if (name === 'brands')   loadBrandsView();
    if (name === 'customers') loadCustomersView();
    if (name === 'reviews')   loadReviewsView();
    if (name === 'seleccion') loadSeleccion();
    if (name === 'settings')  loadShippingConfig();
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'new') openNew();
      else if (btn.dataset.view === 'neworder') openNewOrder();
      else switchView(btn.dataset.view);
    });
  });

  // ─── Products list ───────────────────────────────────────────────────────────
  const PRODUCTS_PER_PAGE = 15;
  let currentProductsPage = 1;

  async function loadProducts(page = currentProductsPage) {
    adminList.innerHTML = '<div class="table-loading">Cargando...</div>';
    currentProductsPage = page;
    const cat = adminCatFilter.value;
    const q = adminSearch.value.trim();
    const params = new URLSearchParams();
    if (cat !== 'all') params.set('category', cat);
    if (q) params.set('search', q);
    params.set('page', page);
    params.set('limit', PRODUCTS_PER_PAGE);

    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      renderTable(data.products, data.total, data.page, data.pages);
    } catch {
      adminList.innerHTML = '<div class="table-empty">Error al cargar productos.</div>';
    }
  }

  function renderTable(products, total, page, pages) {
    if (!products.length) {
      adminList.innerHTML = '<div class="table-empty">No hay productos.</div>';
      return;
    }

    adminList.innerHTML = `<table class="product-table">
      <thead>
        <tr>
          <th></th>
          <th>Nombre</th>
          <th>Categoría</th>
          <th>Talles</th>
          <th>Precio</th>
          <th>Envío</th>
          <th>Stock</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => {
          let stockHtml;
          if (p.stock === 0) stockHtml = `<span class="stock-out">0 — Sin stock</span>`;
          else if (p.stock <= 5) stockHtml = `<span class="stock-low">${p.stock} — Poco</span>`;
          else stockHtml = `<span class="stock-ok">${p.stock}</span>`;

          const sizesArr = Array.isArray(p.sizes) ? p.sizes : [];
          const sizesHtml = sizesArr.length
            ? sizesArr.map(s => `<span class="size-tag-sm">${s}</span>`).join('')
            : '<span style="color:#aaa">—</span>';

          const isOffer = p.compare_price && p.compare_price > p.price;
          const priceHtml = isOffer
            ? `<span class="table-offer-badge">OFERTA</span><br><span class="td-price-sale">${formatPrice(p.price)}</span> <span class="td-price-orig">${formatPrice(p.compare_price)}</span>`
            : formatPrice(p.price);

          const shipHtml = p.shipping_days
            ? `<span class="td-ship">${escHtml(p.shipping_days)}</span>`
            : '<span style="color:#aaa">—</span>';

          const thumbHtml = p.cover
            ? `<img src="/img/products/${p.cover}" class="td-thumb" alt="" />`
            : `<div class="td-thumb td-thumb--empty"></div>`;

          const lowStockBadge = p.low_stock ? `<span style="display:inline-block;margin-left:6px;background:#b45309;color:#fff;font-size:0.62rem;font-weight:700;letter-spacing:0.06em;padding:1px 5px;vertical-align:middle">POCAS</span>` : '';
          return `<tr>
            <td class="td-img">${thumbHtml}</td>
            <td class="td-name"><span title="${escHtml(p.name)}">${escHtml(p.name)}</span>${lowStockBadge}</td>
            <td class="td-category"><span class="badge">${CAT_LABELS[p.category] || p.category}</span></td>
            <td class="td-sizes">${sizesHtml}</td>
            <td class="td-price">${priceHtml}</td>
            <td class="td-shipping">${shipHtml}</td>
            <td class="td-stock">${stockHtml}</td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>
              <button class="btn btn-danger btn-sm" data-delete="${p.id}">Eliminar</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` + renderAdminPagination(page, pages, 'products');

    adminList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit)));
    });
    adminList.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.delete)));
    });
  }

  adminSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    currentProductsPage = 1;
    searchTimer = setTimeout(() => loadProducts(1), 350);
  });
  adminCatFilter.addEventListener('change', () => { currentProductsPage = 1; loadProducts(1); });

  function statusSlug(s) {
    return String(s || 'pending').replace(/[^a-z0-9_-]/gi, '') || 'pending';
  }

  function orderChannelLabel(o, data) {
    if (data.paymentMethod === 'whatsapp') return 'WhatsApp / transferencia';
    const st = String(o.status || '');
    if (st.includes('paypal')) return 'PayPal';
    if (st.includes('azul')) return 'Tarjeta AZUL';
    if (data.paymentMethod) return escHtml(String(data.paymentMethod));
    return '—';
  }

  function statusLabel(status) {
    return ORDER_STATUS_LABEL[status] || escHtml(status || '—');
  }

  const ORDERS_PER_PAGE = 10;
  let currentOrdersPage = 1;

  // ─── Export orders ───────────────────────────────────────────────────────────
  async function exportOrders(format) {
    const from  = document.getElementById('exportFrom')?.value || '';
    const to    = document.getElementById('exportTo')?.value   || '';
    const csvBtn = document.getElementById('exportCsvBtn');
    const pdfBtn = document.getElementById('exportPdfBtn');
    const activeBtn = format === 'csv' ? csvBtn : pdfBtn;

    const params = new URLSearchParams({ format });
    if (from) params.set('from', from);
    if (to)   params.set('to', to);

    activeBtn.disabled = true;
    activeBtn.textContent = 'Generando...';
    try {
      const res = await fetch(`/api/admin/orders/export?${params}`, { headers: authHeaders() });
      if (!res.ok) { showToast('Error al exportar.', true); return; }

      if (format === 'csv') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedidos_${from||'inicio'}_${to||'hoy'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const html = await res.text();
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
      }
    } catch {
      showToast('Error de conexión.', true);
    } finally {
      activeBtn.disabled = false;
      activeBtn.textContent = format === 'csv' ? '⬇ CSV' : '⬇ PDF';
    }
  }

  document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportOrders('csv'));
  document.getElementById('exportPdfBtn')?.addEventListener('click', () => exportOrders('pdf'));

  // Set default export dates (last 30 days)
  (function setDefaultDates() {
    const toEl   = document.getElementById('exportTo');
    const fromEl = document.getElementById('exportFrom');
    if (!toEl || !fromEl) return;
    const now   = new Date();
    const month = new Date(now); month.setDate(month.getDate() - 30);
    toEl.value   = now.toISOString().slice(0, 10);
    fromEl.value = month.toISOString().slice(0, 10);
  })();

  async function loadOrders(page = currentOrdersPage) {
    if (!token || !ordersList) return;
    currentOrdersPage = page;
    ordersList.innerHTML = '<div class="table-loading">Cargando pedidos...</div>';
    try {
      const res = await fetch(`/api/admin/orders?page=${page}&limit=${ORDERS_PER_PAGE}`, { headers: authHeaders() });
      if (!res.ok) {
        ordersList.innerHTML = '<div class="table-empty">No se pudieron cargar los pedidos.</div>';
        return;
      }
      const data = await res.json();
      renderOrders(data.orders, data.total, data.page, data.pages);
    } catch {
      ordersList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  function renderOrders(orders, total, page, pages) {
    window._lastOrders = orders;
    if (!orders.length) {
      ordersList.innerHTML = '<div class="table-empty">No hay pedidos registrados.</div>';
      return;
    }
    ordersList.innerHTML =
      orders.map(renderOrderCard).join('') +
      renderAdminPagination(page, pages, 'orders');
  }

  function renderOrderCard(o) {
    let data = {};
    try { data = JSON.parse(o.items_json || '{}'); } catch { /* ignore */ }
    const ship = data.shipping || {};
    const cart = Array.isArray(data.cart) ? data.cart : [];
    const channel = orderChannelLabel(o, data);
    const subNum = Number.isFinite(Number(data.subtotal)) ? Number(data.subtotal) : Number(o.subtotal);
    const shipFee = Number.isFinite(Number(data.shippingFee))
      ? Number(data.shippingFee)
      : Math.max(0, Math.round((Number(o.total) - subNum) * 100) / 100);

    const shipBlock = ship.name
      ? `<div class="order-card__section">
          <h4 class="order-card__h">Envío</h4>
          <p>${escHtml(ship.name)} · ${escHtml(ship.phone || '')}</p>
          <p>${escHtml(ship.country || '')} — ${escHtml(ship.province || '')}</p>
          <p>${escHtml(ship.address || '')}</p>
        </div>`
      : '<div class="order-card__section"><p class="order-muted">Sin datos de envío en el pedido.</p></div>';

    const itemsHtml = cart.length
      ? `<ul class="order-card__items">
          ${cart.map((i, idx) => {
            const line = Number(i.price) * Number(i.qty);
            return `<li class="order-card__item-row">
              <span class="order-card__iname">${escHtml(i.name)}</span>
              <input type="text" class="size-edit-input" data-item-idx="${idx}" value="${escHtml(i.size || '')}" placeholder="Talla" title="Talla" />
              <span class="order-card__iqty">×${i.qty}</span>
              <span class="order-card__iprice">${formatPrice(line)}</span>
            </li>`;
          }).join('')}
        </ul>
        <button type="button" class="btn btn-sm save-sizes-btn" data-order-id="${o.id}">Guardar tallas</button>
        <span class="sizes-save-feedback hidden" id="szfb-${o.id}">✓ Tallas guardadas</span>`
      : '<p class="order-muted">Sin detalle de productos en JSON.</p>';

    const st = o.status || '';
    const currentStage = o.tracking_stage || 'received';
    const tCode = o.tracking_code || '';
    const tLink = tCode ? `${window.location.origin}/tracking?code=${encodeURIComponent(tCode)}` : '';

    const stageOptions = TRACKING_STAGES.map(s =>
      `<option value="${s}" ${s === currentStage ? 'selected' : ''}>${TRACKING_STAGE_LABEL[s] || s}</option>`
    ).join('');

    const trackingBlock = `
      <div class="order-card__section order-card__tracking">
        <h4 class="order-card__h">Tracking</h4>
        <div class="tracking-admin-row">
          <div class="tracking-code-edit-wrap">
            <label class="tracking-code-label" for="tcode-${o.id}">Código del cliente:</label>
            <input
              type="text"
              id="tcode-${o.id}"
              class="tracking-code-input"
              value="${escHtml(tCode)}"
              placeholder="Ej: CLZ-AB12CD"
              maxlength="30"
              spellcheck="false"
              autocomplete="off"
              data-order-id="${o.id}"
            />
            ${tLink
              ? `<button type="button" class="btn-copy-link" data-link="${escHtml(tLink)}" title="Copiar link">Copiar link</button>
                 <a href="${escHtml(tLink)}" target="_blank" rel="noopener" class="btn-open-tracking">Ver</a>`
              : ''}
          </div>
          <div class="tracking-stage-select-wrap">
            <label class="tracking-stage-label-text" for="stage-${o.id}">Etapa:</label>
            <select class="tracking-stage-select" id="stage-${o.id}" data-order-id="${o.id}">
              ${stageOptions}
            </select>
          </div>
        </div>
        <textarea class="tracking-notes-input" id="notes-${o.id}" data-order-id="${o.id}"
          placeholder="Notas internas del tracking (ej: número de guía, transportista, fecha estimada...)" rows="2">${escHtml(o.tracking_notes || '')}</textarea>
        <button type="button" class="btn btn-primary btn-sm tracking-save-btn" data-order-id="${o.id}">
          Guardar tracking
        </button>
        <span class="tracking-save-feedback hidden" id="tsave-${o.id}">✓ Guardado</span>
      </div>`;

    return `
      <article class="order-card" data-order-id="${o.id}">
        <header class="order-card__head">
          <span class="order-card__num">${escHtml(o.order_number)}</span>
          <span class="order-card__status order-card__status--${statusSlug(st)}">${statusLabel(st)}</span>
          <span class="order-card__tracking-badge order-card__tracking-badge--${escHtml(currentStage)}">
            ${TRACKING_STAGE_LABEL[currentStage] || currentStage}
          </span>
          <div class="order-card__actions">
            <button class="btn btn-ghost btn-sm" data-edit-order="${o.id}" title="Editar pedido">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete-order="${o.id}" title="Eliminar pedido">Eliminar</button>
          </div>
        </header>
        <p class="order-card__meta"><time>${escHtml(o.created_at || '')}</time> · Cliente: ${escHtml(o.customer_name || '—')}</p>
        ${shipBlock}
        <div class="order-card__section">
          <h4 class="order-card__h">Productos</h4>
          ${itemsHtml}
        </div>
        ${trackingBlock}
        <footer class="order-card__foot">
          <div class="order-card__totals">
            <span>Subtotal ${formatPrice(subNum)}</span>
            <span>Envío ${formatPrice(shipFee)}</span>
            <strong>Total ${formatPrice(o.total)}</strong>
          </div>
          <span class="order-card__channel">${channel}</span>
        </footer>
      </article>`;
  }

  // ─── Tracking save handler (delegated) ──────────────────────────────────────
  document.addEventListener('click', async (e) => {
    // Save tracking button
    const saveBtn = e.target.closest('.tracking-save-btn');
    if (saveBtn) {
      const orderId = saveBtn.dataset.orderId;
      const stageEl  = document.getElementById(`stage-${orderId}`);
      const notesEl  = document.getElementById(`notes-${orderId}`);
      const codeEl   = document.getElementById(`tcode-${orderId}`);
      const feedback = document.getElementById(`tsave-${orderId}`);
      if (!stageEl) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            tracking_code:  codeEl?.value.trim().toUpperCase() || '',
            tracking_stage: stageEl.value,
            tracking_notes: notesEl?.value || '',
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(d.error || 'Error al guardar.', true);
        } else {
          feedback?.classList.remove('hidden');
          setTimeout(() => feedback?.classList.add('hidden'), 2500);
          // Update badge
          const card = saveBtn.closest('.order-card');
          const badge = card?.querySelector('.order-card__tracking-badge');
          if (badge) {
            badge.textContent = TRACKING_STAGE_LABEL[stageEl.value] || stageEl.value;
            badge.className = `order-card__tracking-badge order-card__tracking-badge--${stageEl.value}`;
          }
          // Update copy-link button with new code/url
          if (d.tracking_url && codeEl) {
            const linkBtn = saveBtn.closest('.order-card__tracking')?.querySelector('.btn-copy-link');
            if (linkBtn) linkBtn.dataset.link = d.tracking_url;
            const openBtn = saveBtn.closest('.order-card__tracking')?.querySelector('.btn-open-tracking');
            if (openBtn) openBtn.href = d.tracking_url;
          }
          showToast('Tracking actualizado correctamente.');
        }
      } catch {
        showToast('Error de conexión.', true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar tracking';
      }
    }

    // Save sizes button
    const saveSizesBtn = e.target.closest('.save-sizes-btn');
    if (saveSizesBtn) {
      const orderId = saveSizesBtn.dataset.orderId;
      const card = saveSizesBtn.closest('.order-card');
      const feedback = document.getElementById(`szfb-${orderId}`);
      const inputs = card?.querySelectorAll('.size-edit-input');
      if (!inputs?.length) return;
      const sizes = [...inputs].map(inp => ({ index: Number(inp.dataset.itemIdx), size: inp.value.trim() }));
      saveSizesBtn.disabled = true;
      saveSizesBtn.textContent = 'Guardando...';
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/item-sizes`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ sizes }),
        });
        if (res.ok) {
          feedback?.classList.remove('hidden');
          setTimeout(() => feedback?.classList.add('hidden'), 2500);
          showToast('Tallas actualizadas.');
        } else {
          const d = await res.json().catch(() => ({}));
          showToast(d.error || 'Error al guardar tallas.', true);
        }
      } catch {
        showToast('Error de conexión.', true);
      } finally {
        saveSizesBtn.disabled = false;
        saveSizesBtn.textContent = 'Guardar tallas';
      }
    }

    // Copy tracking code button
    const copyBtn = e.target.closest('.btn-copy-code');
    if (copyBtn) {
      const code = copyBtn.dataset.code;
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⎘'; }, 1500);
      } catch {
        showToast('No se pudo copiar al portapapeles.', true);
      }
    }

    // Copy tracking link
    const copyLinkBtn = e.target.closest('.btn-copy-link');
    if (copyLinkBtn) {
      const link = copyLinkBtn.dataset.link;
      try {
        await navigator.clipboard.writeText(link);
        copyLinkBtn.textContent = '✓ Link copiado';
        setTimeout(() => { copyLinkBtn.textContent = 'Copiar link'; }, 1500);
      } catch {
        showToast('No se pudo copiar el link.', true);
      }
    }
  });

  // ─── Product Form ────────────────────────────────────────────────────────────
  // ─── Brands helpers ──────────────────────────────────────────────────────────
  const fBrand         = document.getElementById('fBrand');
  const brandNameInput = document.getElementById('brandNameInput');
  const brandAddBtn    = document.getElementById('brandAddBtn');
  const brandFormError = document.getElementById('brandFormError');
  const brandList      = document.getElementById('brandList');

  let cachedBrands = [];

  async function fetchBrands() {
    try {
      const res = await fetch('/api/brands');
      cachedBrands = res.ok ? await res.json() : [];
    } catch { cachedBrands = []; }
    return cachedBrands;
  }

  async function populateBrandSelect(selectedId) {
    await fetchBrands();
    if (!fBrand) return;
    fBrand.innerHTML = '<option value="">Sin marca</option>' +
      cachedBrands.map(b => `<option value="${b.id}"${Number(selectedId) === b.id ? ' selected' : ''}>${escHtml(b.name)}</option>`).join('');
  }

  async function loadBrandsView() {
    if (!brandList) return;
    brandList.innerHTML = '<div class="table-loading">Cargando...</div>';
    await fetchBrands();
    if (!cachedBrands.length) {
      brandList.innerHTML = '<div class="table-empty">No hay marcas. Agregá la primera.</div>';
      return;
    }
    brandList.innerHTML = `<table class="promo-table">
      <thead><tr><th>Marca</th><th></th></tr></thead>
      <tbody>
        ${cachedBrands.map(b => `<tr>
          <td id="brand-name-${b.id}">${escHtml(b.name)}</td>
          <td>
            <div class="promo-actions">
              <button class="btn btn-ghost btn-sm" data-brand-rename="${b.id}" data-brand-current="${escHtml(b.name)}">Renombrar</button>
              <button class="btn btn-danger btn-sm" data-brand-delete="${b.id}" data-brand-name="${escHtml(b.name)}">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  brandAddBtn?.addEventListener('click', async () => {
    brandFormError.classList.add('hidden');
    const name = (brandNameInput?.value || '').trim();
    if (!name) { showError(brandFormError, 'Ingresá un nombre.'); return; }
    brandAddBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { showError(brandFormError, data.error || 'Error al crear.'); return; }
      brandNameInput.value = '';
      showToast(`Marca "${name}" creada.`);
      loadBrandsView();
    } catch { showError(brandFormError, 'Error de conexión.'); }
    finally { brandAddBtn.disabled = false; }
  });

  brandNameInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); brandAddBtn?.click(); }
  });

  brandList?.addEventListener('click', async e => {
    const renameBtn = e.target.closest('[data-brand-rename]');
    const deleteBtn = e.target.closest('[data-brand-delete]');

    if (renameBtn) {
      const id      = renameBtn.dataset.brandRename;
      const current = renameBtn.dataset.brandCurrent;
      const newName = prompt(`Nuevo nombre para "${current}":`, current);
      if (!newName || newName.trim() === current) return;
      try {
        const res = await fetch(`/api/admin/brands/${id}`, {
          method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: newName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Error.', true); return; }
        showToast('Marca actualizada.');
        loadBrandsView();
      } catch { showToast('Error de conexión.', true); }
    }

    if (deleteBtn) {
      const id   = deleteBtn.dataset.brandDelete;
      const name = deleteBtn.dataset.brandName;
      if (!confirm(`¿Eliminar la marca "${name}"? Los productos quedarán sin marca.`)) return;
      try {
        const res = await fetch(`/api/admin/brands/${id}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error.', true); return; }
        showToast(`Marca "${name}" eliminada.`);
        loadBrandsView();
      } catch { showToast('Error de conexión.', true); }
    }
  });

  // ─── Customer photos ─────────────────────────────────────────────────────────
  const cpProductSearch   = document.getElementById('cpProductSearch');
  const cpProductId       = document.getElementById('cpProductId');
  const cpProductDropdown = document.getElementById('cpProductDropdown');
  const cpProductSelected = document.getElementById('cpProductSelected');
  const cpCaption         = document.getElementById('cpCaption');
  const cpImage           = document.getElementById('cpImage');
  const cpAddBtn          = document.getElementById('cpAddBtn');
  const cpFormError       = document.getElementById('cpFormError');
  const customerPhotoList = document.getElementById('customerPhotoList');
  let cpSearchTimer = null;

  function clearCpProductSelection() {
    if (cpProductId) cpProductId.value = '';
    if (cpProductSelected) {
      cpProductSelected.textContent = '';
      cpProductSelected.classList.add('hidden');
    }
  }

  function selectCpProduct(product) {
    if (cpProductId) cpProductId.value = product.id;
    if (cpProductSearch) cpProductSearch.value = product.name;
    if (cpProductSelected) {
      cpProductSelected.textContent = `Producto seleccionado: ${product.name}`;
      cpProductSelected.classList.remove('hidden');
    }
    cpProductDropdown?.classList.add('hidden');
  }

  cpProductSearch?.addEventListener('input', () => {
    clearTimeout(cpSearchTimer);
    clearCpProductSelection();
    const q = cpProductSearch.value.trim();
    if (!q) {
      cpProductDropdown?.classList.add('hidden');
      return;
    }
    cpSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?category=calzado&search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        const products = data.products || data;
        if (!products.length) {
          cpProductDropdown.innerHTML = '<div class="cp-product-empty">Sin resultados</div>';
        } else {
          cpProductDropdown.innerHTML = products.map(p => `
            <button type="button" class="cp-product-option" data-id="${p.id}">
              ${p.cover ? `<img src="/img/products/${escHtml(p.cover)}" alt="" />` : ''}
              <span>${escHtml(p.name)}</span>
            </button>`).join('');
        }
        cpProductDropdown.classList.remove('hidden');
      } catch {
        cpProductDropdown.classList.add('hidden');
      }
    }, 220);
  });

  cpProductDropdown?.addEventListener('click', e => {
    const btn = e.target.closest('.cp-product-option');
    if (!btn) return;
    selectCpProduct({ id: btn.dataset.id, name: btn.querySelector('span')?.textContent || '' });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.customer-photo-product-field')) {
      cpProductDropdown?.classList.add('hidden');
    }
  }, { passive: true });

  async function loadCustomersView() {
    if (!customerPhotoList) return;
    customerPhotoList.innerHTML = '<div class="table-loading">Cargando...</div>';
    try {
      const res = await fetch('/api/admin/customer-photos', { headers: authHeaders() });
      const rows = await res.json();
      if (!res.ok) {
        customerPhotoList.innerHTML = `<div class="table-empty">${escHtml(rows.error || 'Error al cargar.')}</div>`;
        return;
      }
      if (!rows.length) {
        customerPhotoList.innerHTML = '<div class="table-empty">Todavía no hay fotos de clientes. Subí la primera arriba.</div>';
        return;
      }
      customerPhotoList.innerHTML = rows.map(r => `
        <div class="customer-photo-card${r.active ? '' : ' customer-photo-card--hidden'}" data-id="${r.id}">
          ${customerMediaMarkup(r, 'customer-photo-card__img')}
          <div class="customer-photo-card__body">
            <p class="customer-photo-card__product">${r.product_name ? escHtml(r.product_name) : 'Sin producto asociado'}</p>
            ${r.caption ? `<p class="customer-photo-card__caption">${escHtml(r.caption)}</p>` : ''}
            <div class="customer-photo-card__actions">
              <button type="button" class="btn btn-ghost btn-sm" data-cp-toggle="${r.id}" data-active="${r.active ? '1' : '0'}">
                ${r.active ? 'Ocultar' : 'Mostrar'}
              </button>
              <button type="button" class="btn btn-danger btn-sm" data-cp-delete="${r.id}">Eliminar</button>
            </div>
          </div>
        </div>`).join('');
    } catch {
      customerPhotoList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  cpAddBtn?.addEventListener('click', async () => {
    cpFormError.classList.add('hidden');
    const productId = cpProductId?.value;
    const file = cpImage?.files?.[0];
    if (!file) { showError(cpFormError, 'Elegí una imagen.'); return; }

    const fd = new FormData();
    if (productId) fd.append('product_id', productId);
    fd.append('caption', cpCaption?.value.trim() || '');
    fd.append('image', file);

    cpAddBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/customer-photos', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { showError(cpFormError, data.error || 'Error al subir.'); return; }
      cpCaption.value = '';
      cpImage.value = '';
      cpProductSearch.value = '';
      clearCpProductSelection();
      showToast('Foto de cliente agregada.');
      loadCustomersView();
    } catch {
      showError(cpFormError, 'Error de conexión.');
    } finally {
      cpAddBtn.disabled = false;
    }
  });

  customerPhotoList?.addEventListener('click', async e => {
    const toggleBtn = e.target.closest('[data-cp-toggle]');
    const deleteBtn = e.target.closest('[data-cp-delete]');

    if (toggleBtn) {
      const id = toggleBtn.dataset.cpToggle;
      const active = toggleBtn.dataset.active !== '1';
      try {
        const res = await fetch(`/api/admin/customer-photos/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ active }),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error.', true); return; }
        showToast(active ? 'Foto visible en la tienda.' : 'Foto oculta.');
        loadCustomersView();
      } catch { showToast('Error de conexión.', true); }
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.cpDelete;
      if (!confirm('¿Eliminar esta foto de cliente?')) return;
      try {
        const res = await fetch(`/api/admin/customer-photos/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error.', true); return; }
        showToast('Foto eliminada.');
        loadCustomersView();
      } catch { showToast('Error de conexión.', true); }
    }
  });

  // ─── Reviews admin ───────────────────────────────────────────────────────────
  const reviewsAdminList     = document.getElementById('reviewsAdminList');
  const editReviewModal      = document.getElementById('editReviewModal');
  const editReviewBackdrop   = document.getElementById('editReviewBackdrop');
  const cancelEditReviewBtn  = document.getElementById('cancelEditReviewBtn');
  const confirmEditReviewBtn = document.getElementById('confirmEditReviewBtn');
  const editReviewError      = document.getElementById('editReviewError');
  const erProductSearch      = document.getElementById('erProductSearch');
  const erProductId          = document.getElementById('erProductId');
  const erProductDropdown    = document.getElementById('erProductDropdown');
  const erProductSelected    = document.getElementById('erProductSelected');
  let erSearchTimer = null;
  let editingReviewId = null;

  function formatReviewAdminDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(String(iso).replace(' ', 'T'));
      if (Number.isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch { return iso; }
  }

  function sqliteToDatetimeLocal(str) {
    if (!str) return '';
    return String(str).trim().replace(' ', 'T').slice(0, 16);
  }

  function clearErProductSelection() {
    if (erProductId) erProductId.value = '';
    if (erProductSelected) {
      erProductSelected.textContent = '';
      erProductSelected.classList.add('hidden');
    }
  }

  function selectErProduct(product) {
    if (erProductId) erProductId.value = product.id;
    if (erProductSearch) erProductSearch.value = product.name;
    if (erProductSelected) {
      erProductSelected.textContent = `Producto: ${product.name}`;
      erProductSelected.classList.remove('hidden');
    }
    erProductDropdown?.classList.add('hidden');
  }

  erProductSearch?.addEventListener('input', () => {
    clearTimeout(erSearchTimer);
    clearErProductSelection();
    const q = erProductSearch.value.trim();
    if (!q) {
      erProductDropdown?.classList.add('hidden');
      return;
    }
    erSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        const products = data.products || data;
        if (!products.length) {
          erProductDropdown.innerHTML = '<div class="cp-product-empty">Sin resultados</div>';
        } else {
          erProductDropdown.innerHTML = products.map(p => `
            <button type="button" class="cp-product-option" data-id="${p.id}">
              ${p.cover ? `<img src="/img/products/${escHtml(p.cover)}" alt="" />` : ''}
              <span>${escHtml(p.name)}</span>
            </button>`).join('');
        }
        erProductDropdown.classList.remove('hidden');
      } catch {
        erProductDropdown?.classList.add('hidden');
      }
    }, 220);
  });

  erProductDropdown?.addEventListener('click', e => {
    const btn = e.target.closest('.cp-product-option');
    if (!btn) return;
    selectErProduct({ id: btn.dataset.id, name: btn.querySelector('span')?.textContent || '' });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.review-product-field')) {
      erProductDropdown?.classList.add('hidden');
    }
  }, { passive: true });

  async function loadReviewsView() {
    if (!reviewsAdminList) return;
    reviewsAdminList.innerHTML = '<div class="table-loading">Cargando...</div>';
    try {
      const res = await fetch('/api/admin/reviews', { headers: authHeaders() });
      const rows = await res.json();
      if (!res.ok) {
        reviewsAdminList.innerHTML = `<div class="table-empty">${escHtml(rows.error || 'Error al cargar.')}</div>`;
        return;
      }
      if (!rows.length) {
        reviewsAdminList.innerHTML = '<div class="table-empty">Todavía no hay reseñas publicadas.</div>';
        return;
      }
      reviewsAdminList.innerHTML = `<table class="review-admin-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cliente</th>
            <th>★</th>
            <th>Reseña</th>
            <th>Fecha</th>
            <th>Foto</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="${r.active ? '' : 'review-admin-row--hidden'}">
              <td>${escHtml(r.product_name || '—')}</td>
              <td>${escHtml(r.reviewer_name || 'Cliente')}</td>
              <td>${'★'.repeat(Number(r.rating) || 0)}</td>
              <td class="review-admin-table__text">${escHtml((r.review_text || '').slice(0, 80))}${(r.review_text || '').length > 80 ? '…' : ''}</td>
              <td>${escHtml(formatReviewAdminDate(r.created_at))}</td>
              <td>${r.filename ? 'Sí' : '—'}</td>
              <td>${r.active ? 'Visible' : 'Oculta'}</td>
              <td class="review-admin-table__actions">
                <button type="button" class="btn btn-ghost btn-sm" data-review-edit="${r.id}">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" data-review-delete="${r.id}">Eliminar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    } catch {
      reviewsAdminList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  function openEditReviewModal(row) {
    editingReviewId = row.id;
    document.getElementById('erId').value = row.id;
    erProductId.value = row.product_id;
    erProductSearch.value = row.product_name || '';
    if (erProductSelected) {
      erProductSelected.textContent = row.product_name ? `Producto: ${row.product_name}` : '';
      erProductSelected.classList.toggle('hidden', !row.product_name);
    }
    document.getElementById('erName').value = row.reviewer_name || '';
    document.getElementById('erRating').value = String(row.rating || 5);
    document.getElementById('erDate').value = sqliteToDatetimeLocal(row.created_at);
    document.getElementById('erText').value = row.review_text || '';
    document.getElementById('erActive').checked = !!row.active;
    document.getElementById('erPhotoFile').value = '';
    document.getElementById('erRemovePhoto').checked = false;

    const photoWrap  = document.getElementById('erPhotoCurrent');
    const photoImg   = document.getElementById('erPhotoImg');
    const photoVideo = document.getElementById('erPhotoVideo');
    const photoAudio = document.getElementById('erPhotoAudio');
    const removeWrap = document.getElementById('erRemovePhotoWrap');
    [photoImg, photoVideo, photoAudio].forEach(el => el?.classList.add('hidden'));
    photoImg?.removeAttribute('src');
    photoVideo?.removeAttribute('src');
    photoAudio?.removeAttribute('src');
    if (row.filename) {
      const src = `/img/customer-photos/${row.filename}`;
      const type = customerMediaType(row);
      const el = type === 'video' ? photoVideo : type === 'audio' ? photoAudio : photoImg;
      if (el) { el.src = src; el.classList.remove('hidden'); }
      photoWrap?.classList.remove('hidden');
      photoWrap?.classList.toggle('review-edit-photo--audio', type === 'audio');
      removeWrap?.classList.remove('hidden');
    } else {
      photoWrap?.classList.add('hidden');
      removeWrap?.classList.add('hidden');
    }

    hideError(editReviewError);
    editReviewModal.classList.add('open');
    editReviewModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditReviewModal() {
    editingReviewId = null;
    editReviewModal?.classList.remove('open');
    editReviewModal?.setAttribute('aria-hidden', 'true');
  }

  cancelEditReviewBtn?.addEventListener('click', closeEditReviewModal);
  editReviewBackdrop?.addEventListener('click', closeEditReviewModal);

  confirmEditReviewBtn?.addEventListener('click', async () => {
    if (!editingReviewId) return;
    hideError(editReviewError);

    const productId = erProductId?.value;
    const reviewer_name = document.getElementById('erName').value.trim();
    const rating = document.getElementById('erRating').value;
    const review_text = document.getElementById('erText').value.trim();
    const created_at = document.getElementById('erDate').value;
    const active = document.getElementById('erActive').checked;
    const remove_photo = document.getElementById('erRemovePhoto').checked;
    const photoFile = document.getElementById('erPhotoFile').files?.[0];

    if (!productId) { showError(editReviewError, 'Seleccioná un producto.'); return; }
    if (!reviewer_name) { showError(editReviewError, 'El nombre es obligatorio.'); return; }
    if (!review_text) { showError(editReviewError, 'La reseña no puede estar vacía.'); return; }
    if (!created_at) { showError(editReviewError, 'Indicá la fecha de publicación.'); return; }

    const fd = new FormData();
    fd.append('product_id', productId);
    fd.append('reviewer_name', reviewer_name);
    fd.append('rating', rating);
    fd.append('review_text', review_text);
    fd.append('created_at', created_at);
    fd.append('active', active ? '1' : '0');
    if (remove_photo) fd.append('remove_photo', '1');
    if (photoFile) fd.append('image', photoFile);

    confirmEditReviewBtn.disabled = true;
    try {
      const res = await fetch(`/api/admin/reviews/${editingReviewId}`, {
        method: 'PUT',
        headers: { 'x-admin-token': token },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { showError(editReviewError, data.error || 'Error al guardar.'); return; }
      showToast('Reseña actualizada.');
      closeEditReviewModal();
      loadReviewsView();
    } catch {
      showError(editReviewError, 'Error de conexión.');
    } finally {
      confirmEditReviewBtn.disabled = false;
    }
  });

  reviewsAdminList?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-review-edit]');
    const deleteBtn = e.target.closest('[data-review-delete]');

    if (editBtn) {
      try {
        const res = await fetch('/api/admin/reviews', { headers: authHeaders() });
        const rows = await res.json();
        const row = rows.find(r => String(r.id) === editBtn.dataset.reviewEdit);
        if (row) openEditReviewModal(row);
      } catch { showToast('Error al cargar la reseña.', true); }
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.reviewDelete;
      if (!confirm('¿Eliminar esta reseña?')) return;
      try {
        const res = await fetch(`/api/admin/reviews/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error.', true); return; }
        showToast('Reseña eliminada.');
        loadReviewsView();
      } catch { showToast('Error de conexión.', true); }
    }
  });

  function resetForm() {
    editId.value = '';
    productForm.reset();
    hideError(formError);
    formTitle.textContent = 'Nuevo producto';
    formSubmitBtn.textContent = 'Guardar producto';
    sizesContainer.innerHTML = '';
    sizesHint.classList.remove('hidden');
    offerBadgePreview.classList.remove('visible');
    if (fHot) fHot.checked = false;
    if (fLowStock) fLowStock.checked = false;
    resetImages();
    populateBrandSelect(null);
  }

  function openNew() {
    resetForm();
    switchView('new');
  }

  async function openEdit(id) {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error();
      const p = await res.json();
      editId.value = p.id;
      fName.value = p.name;
      fCategory.value = p.category;
      fPrice.value = p.price;
      fDesc.value = p.description || '';
      fComparePrice.value = p.compare_price || '';
      fShipping.value = p.shipping_days || '';
      if (fHot) fHot.checked = !!p.hot;
      if (fLowStock) fLowStock.checked = !!p.low_stock;
      renderSizeStockInputs(p.category, Array.isArray(p.sizes) ? p.sizes : [], p.sizes_stock || {});
      updateOfferPreview();
      existingImages = Array.isArray(p.images) ? p.images : [];
      newFiles = [];
      removeIds = [];
      renderImgGrid();
      await populateBrandSelect(p.brand_id);
      formTitle.textContent = 'Editar producto';
      formSubmitBtn.textContent = 'Guardar cambios';
      hideError(formError);
      switchView('new');
    } catch {
      showToast('Error al cargar producto.', true);
    }
  }

  formCancelBtn.addEventListener('click', () => {
    resetForm();
    switchView('products');
  });

  productForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(formError);

    const name = fName.value.trim();
    const category = fCategory.value;
    const price = fPrice.value;
    const description = fDesc.value.trim();
    const sizes = getSelectedSizes();
    const sizes_stock = getSizesStock();
    const compare_price = fComparePrice.value;
    const shipping_days = fShipping.value.trim();
    const brand_id = fBrand?.value || '';
    const id = editId.value;

    if (!name) { showError(formError, 'El nombre del producto es obligatorio.'); return; }
    if (!category) { showError(formError, 'Seleccioná una categoría.'); return; }
    if (price === '' || isNaN(Number(price)) || Number(price) < 0) {
      showError(formError, 'Ingresá un precio válido (mayor o igual a 0).'); return;
    }

    const isEdit = !!id;
    const url = isEdit ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = isEdit ? 'PUT' : 'POST';

    // Use FormData so we can attach the image file
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('price', price);
    formData.append('description', description);
    formData.append('sizes', JSON.stringify(sizes));
    formData.append('sizes_stock', JSON.stringify(sizes_stock));
    formData.append('compare_price', compare_price || '');
    formData.append('shipping_days', shipping_days || '');
    formData.append('brand_id', brand_id || '');
    formData.append('hot', fHot?.checked ? '1' : '0');
    formData.append('low_stock', fLowStock?.checked ? '1' : '0');
    formData.append('remove_image_ids', JSON.stringify(removeIds));
    newFiles.forEach(file => formData.append('images', file));

    try {
      formSubmitBtn.disabled = true;
      formSubmitBtn.textContent = 'Guardando...';
      const res = await fetch(url, {
        method,
        headers: { 'x-admin-token': token }, // No Content-Type — browser sets it with boundary
        body: formData,
      });
      const data = await res.json();
      formSubmitBtn.disabled = false;
      formSubmitBtn.textContent = isEdit ? 'Guardar cambios' : 'Guardar producto';

      if (!res.ok) { showError(formError, data.error || 'Error al guardar.'); return; }
      showToast(isEdit ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
      resetForm();
      switchView('products');
    } catch {
      formSubmitBtn.disabled = false;
      formSubmitBtn.textContent = isEdit ? 'Guardar cambios' : 'Guardar producto';
      showError(formError, 'Error de conexión.');
    }
  });

  // ─── Delete ──────────────────────────────────────────────────────────────────
  function openDeleteModal(id) {
    pendingDeleteId = id;
    deleteModal.classList.add('open');
    deleteModal.setAttribute('aria-hidden', 'false');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModal.classList.remove('open');
    deleteModal.setAttribute('aria-hidden', 'true');
  }

  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  deleteBackdrop.addEventListener('click', closeDeleteModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDeleteModal(); });

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await fetch(`/api/admin/products/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) { showToast('Error al eliminar.', true); return; }
      showToast('Producto eliminado.');
      closeDeleteModal();
      loadProducts();
    } catch {
      showToast('Error de conexión.', true);
    }
  });

  // ─── Shipping config ─────────────────────────────────────────────────────────
  async function loadShippingConfig() {
    try {
      const res = await fetch('/api/admin/shipping-config', { headers: authHeaders() });
      if (!res.ok) return;
      const cfg = await res.json();
      document.getElementById('scStdPrice').value = cfg.standard.price;
      document.getElementById('scStdDays').value  = cfg.standard.days;
      document.getElementById('scPriPrice').value = cfg.priority.price;
      document.getElementById('scPriDays').value  = cfg.priority.days;
    } catch { /* ignore */ }
  }

  document.getElementById('shippingConfigForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const msgEl = document.getElementById('scMsg');
    msgEl.className = 'hidden';
    try {
      const res = await fetch('/api/admin/shipping-config', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          standardPrice: document.getElementById('scStdPrice').value,
          standardDays:  document.getElementById('scStdDays').value,
          priorityPrice: document.getElementById('scPriPrice').value,
          priorityDays:  document.getElementById('scPriDays').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.error || 'Error al guardar.';
        msgEl.className = 'form-error';
        return;
      }
      msgEl.textContent = '¡Configuración de envío guardada!';
      msgEl.className = '';
      msgEl.style.color = '#16a34a';
    } catch {
      msgEl.textContent = 'Error de conexión.';
      msgEl.className = 'form-error';
    }
  });

  // ─── Password change ─────────────────────────────────────────────────────────
  passwordForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(passError);
    const np = newPass.value;
    const cp = confirmPass.value;

    if (!np || np.length < 6) { showError(passError, 'La contraseña debe tener al menos 6 caracteres.'); return; }
    if (np !== cp) { showError(passError, 'Las contraseñas no coinciden.'); return; }

    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ newPassword: np }),
      });
      const data = await res.json();
      if (!res.ok) { showError(passError, data.error || 'Error.'); return; }
      token = data.token;
      sessionStorage.setItem('calziani_token', token);
      showToast('Contraseña actualizada correctamente.');
      passwordForm.reset();
    } catch {
      showError(passError, 'Error de conexión.');
    }
  });

  // ─── Edit / Delete orders ────────────────────────────────────────────────────
  let editingOrderId = null;
  let deletingOrderId = null;

  const editOrderModal      = document.getElementById('editOrderModal');
  const editOrderBackdrop   = document.getElementById('editOrderBackdrop');
  const cancelEditBtn       = document.getElementById('cancelEditBtn');
  const confirmEditBtn      = document.getElementById('confirmEditBtn');
  const editOrderError      = document.getElementById('editOrderError');

  const deleteOrderModal    = document.getElementById('deleteOrderModal');
  const deleteOrderBackdrop = document.getElementById('deleteOrderBackdrop');
  const cancelDeleteOrderBtn  = document.getElementById('cancelDeleteOrderBtn');
  const confirmDeleteOrderBtn = document.getElementById('confirmDeleteOrderBtn');

  function openEditOrderModal(o) {
    let data = {};
    try { data = JSON.parse(o.items_json || '{}'); } catch {}
    const ship = data.shipping || {};
    editingOrderId = o.id;
    document.getElementById('editOrderNum').textContent  = o.order_number;
    document.getElementById('eoName').value     = ship.name     || o.customer_name || '';
    document.getElementById('eoPhone').value    = ship.phone    || '';
    document.getElementById('eoCountry').value  = ship.country  || '';
    document.getElementById('eoProvince').value = ship.province || '';
    document.getElementById('eoAddress').value  = ship.address  || '';
    document.getElementById('eoStatus').value   = o.status      || 'pending_transfer';
    hideError(editOrderError);
    editOrderModal.classList.add('open');
    editOrderModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditOrderModal() {
    editingOrderId = null;
    editOrderModal.classList.remove('open');
    editOrderModal.setAttribute('aria-hidden', 'true');
  }

  function openDeleteOrderModal(id, orderNumber) {
    deletingOrderId = id;
    document.getElementById('deleteOrderBody').textContent =
      `¿Seguro que querés eliminar el pedido ${orderNumber}? Esta acción no se puede deshacer.`;
    deleteOrderModal.classList.add('open');
    deleteOrderModal.setAttribute('aria-hidden', 'false');
  }

  function closeDeleteOrderModal() {
    deletingOrderId = null;
    deleteOrderModal.classList.remove('open');
    deleteOrderModal.setAttribute('aria-hidden', 'true');
  }

  cancelEditBtn?.addEventListener('click', closeEditOrderModal);
  editOrderBackdrop?.addEventListener('click', closeEditOrderModal);
  cancelDeleteOrderBtn?.addEventListener('click', closeDeleteOrderModal);
  deleteOrderBackdrop?.addEventListener('click', closeDeleteOrderModal);

  confirmEditBtn?.addEventListener('click', async () => {
    if (!editingOrderId) return;
    hideError(editOrderError);
    const body = {
      customer_name: document.getElementById('eoName').value.trim(),
      customer_phone: document.getElementById('eoPhone').value.trim(),
      country:  document.getElementById('eoCountry').value.trim(),
      province: document.getElementById('eoProvince').value.trim(),
      address:  document.getElementById('eoAddress').value.trim(),
      status:   document.getElementById('eoStatus').value,
    };
    if (!body.customer_name) { showError(editOrderError, 'El nombre es obligatorio.'); return; }
    confirmEditBtn.disabled = true;
    confirmEditBtn.textContent = 'Guardando...';
    try {
      const res = await fetch(`/api/admin/orders/${editingOrderId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showError(editOrderError, data.error || 'Error al guardar.'); return; }
      showToast('Pedido actualizado correctamente.');
      closeEditOrderModal();
      loadOrders();
    } catch {
      showError(editOrderError, 'Error de conexión.');
    } finally {
      confirmEditBtn.disabled = false;
      confirmEditBtn.textContent = 'Guardar cambios';
    }
  });

  confirmDeleteOrderBtn?.addEventListener('click', async () => {
    if (!deletingOrderId) return;
    confirmDeleteOrderBtn.disabled = true;
    confirmDeleteOrderBtn.textContent = 'Eliminando...';
    try {
      const res = await fetch(`/api/admin/orders/${deletingOrderId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Error al eliminar.', true);
      } else {
        showToast('Pedido eliminado.');
        closeDeleteOrderModal();
        loadOrders();
      }
    } catch {
      showToast('Error de conexión.', true);
    } finally {
      confirmDeleteOrderBtn.disabled = false;
      confirmDeleteOrderBtn.textContent = 'Eliminar';
    }
  });

  // Wire edit/delete buttons on order cards (delegated)
  ordersList?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-order]');
    if (editBtn) {
      const id = Number(editBtn.dataset.editOrder);
      const card = editBtn.closest('.order-card');
      // Reconstruct minimal order object from the DOM/loaded data or re-fetch
      const orderNum = card?.querySelector('.order-card__num')?.textContent || '';
      // Find in last loaded orders list
      const cached = (window._lastOrders || []).find(o => o.id === id);
      if (cached) { openEditOrderModal(cached); return; }
      // fallback: reload current page
      fetch(`/api/admin/orders?page=${currentOrdersPage}&limit=${ORDERS_PER_PAGE}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          const orders = data.orders || data;
          window._lastOrders = orders;
          const o = orders.find(x => x.id === id);
          if (o) openEditOrderModal(o);
        });
      return;
    }
    const delBtn = e.target.closest('[data-delete-order]');
    if (delBtn) {
      const id = Number(delBtn.dataset.deleteOrder);
      const card = delBtn.closest('.order-card');
      const orderNum = card?.querySelector('.order-card__num')?.textContent || `#${id}`;
      openDeleteOrderModal(id, orderNum);
    }
  });

  // ─── New Order (manual) ──────────────────────────────────────────────────────
  const newOrderForm        = document.getElementById('newOrderForm');
  const newOrderSuccess     = document.getElementById('newOrderSuccess');
  const newOrderError       = document.getElementById('newOrderError');
  const newOrderSubmitBtn   = document.getElementById('newOrderSubmitBtn');
  const newOrderCancelBtn   = document.getElementById('newOrderCancelBtn');
  const noItemsTable        = document.getElementById('noItemsTable');
  const noAddRowBtn         = document.getElementById('noAddRow');
  let noRowCount = 0;

  function addOrderRow(opts = {}) {
    // opts: { name, size, qty, price, cover, id, sizes }
    const { name = '', size = '', qty = 1, price = '', cover = '', id = '', sizes = [] } = opts;
    noRowCount++;
    const rowId = noRowCount;
    const row = document.createElement('div');
    row.className = 'no-item-row';
    row.dataset.rowId = rowId;

    const sizesOpts = sizes.length
      ? `<option value="">— talle —</option>` + sizes.map(s => `<option value="${escHtml(s)}"${s === size ? ' selected' : ''}>${escHtml(s)}</option>`).join('')
      : '';

    row.innerHTML = `
      <div class="no-r-product-wrap">
        ${cover ? `<img src="/img/products/${escHtml(cover)}" class="no-r-thumb" alt="" />` : `<div class="no-r-thumb-empty"></div>`}
        <div class="no-r-search-wrap" style="flex:1;position:relative">
          <input type="text" class="no-r-name" placeholder="Buscar producto o escribir nombre…" value="${escHtml(String(name))}" autocomplete="off" />
          <div class="no-r-dropdown hidden"></div>
        </div>
        <input type="hidden" class="no-r-cover" value="${escHtml(cover)}" />
        <input type="hidden" class="no-r-id"    value="${escHtml(String(id))}" />
      </div>
      ${sizesOpts
        ? `<select class="no-r-size-sel">${sizesOpts}</select>`
        : `<input type="text" class="no-r-size" placeholder="Talle" value="${escHtml(String(size))}" />`}
      <input type="number" class="no-r-qty"   placeholder="1"    min="1"   step="1"    value="${Number(qty) || 1}" />
      <input type="number" class="no-r-price" placeholder="0.00" min="0"   step="0.01" value="${price !== '' ? Number(price) : ''}" />
      <button type="button" class="no-item-remove" title="Quitar">×</button>`;

    // Remove row
    row.querySelector('.no-item-remove').addEventListener('click', () => {
      row.remove();
      if (!noItemsTable.querySelectorAll('.no-item-row').length) addOrderRow();
    });

    // Product search as-you-type
    const nameInput = row.querySelector('.no-r-name');
    const dropdown  = row.querySelector('.no-r-dropdown');
    let searchTimer = null;

    nameInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = nameInput.value.trim();
      if (q.length < 2) { dropdown.classList.add('hidden'); return; }
      searchTimer = setTimeout(async () => {
        try {
          const res  = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`, { headers: { 'x-admin-token': token } });
          const data = await res.json();
          const list = data.products || data || [];
          if (!list.length) { dropdown.classList.add('hidden'); return; }
          dropdown.innerHTML = list.map(p => `
            <div class="no-r-dropdown-item" data-id="${p.id}" data-name="${escHtml(p.name)}"
                 data-price="${p.price}" data-cover="${escHtml(p.cover || '')}"
                 data-sizes="${escHtml(JSON.stringify(Array.isArray(p.sizes) ? p.sizes : []))}">
              ${p.cover ? `<img src="/img/products/${escHtml(p.cover)}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;flex-shrink:0" />` : ''}
              <div>
                <div style="font-weight:600;font-size:0.82rem">${escHtml(p.name)}</div>
                <div style="font-size:0.75rem;color:#888">$${p.price}</div>
              </div>
            </div>`).join('');
          dropdown.classList.remove('hidden');
        } catch { dropdown.classList.add('hidden'); }
      }, 220);
    });

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.no-r-dropdown-item');
      if (!item) return;
      // Fill row fields
      nameInput.value = item.dataset.name;
      row.querySelector('.no-r-cover').value = item.dataset.cover;
      row.querySelector('.no-r-id').value    = item.dataset.id;
      row.querySelector('.no-r-price').value = item.dataset.price;

      // Update thumb
      const thumbWrap = row.querySelector('.no-r-thumb, .no-r-thumb-empty');
      if (item.dataset.cover) {
        const img = document.createElement('img');
        img.src = `/img/products/${item.dataset.cover}`;
        img.className = 'no-r-thumb';
        img.alt = '';
        thumbWrap.replaceWith(img);
      }

      // Replace size input with select if product has sizes
      let productSizes = [];
      try { productSizes = JSON.parse(item.dataset.sizes); } catch { productSizes = []; }
      const sizeCell = row.querySelector('.no-r-size-sel, .no-r-size');
      if (productSizes.length) {
        const sel = document.createElement('select');
        sel.className = 'no-r-size-sel';
        sel.innerHTML = `<option value="">— talle —</option>` +
          productSizes.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
        sizeCell.replaceWith(sel);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'no-r-size'; inp.placeholder = 'Talle';
        sizeCell.replaceWith(inp);
      }

      dropdown.classList.add('hidden');
    });

    document.addEventListener('click', e => {
      if (!row.contains(e.target)) dropdown.classList.add('hidden');
    }, { passive: true });

    noItemsTable.appendChild(row);
  }

  function getOrderItems() {
    return [...noItemsTable.querySelectorAll('.no-item-row')].map(row => {
      const sizeSel = row.querySelector('.no-r-size-sel');
      const sizeInp = row.querySelector('.no-r-size');
      return {
        name:  row.querySelector('.no-r-name').value.trim(),
        size:  (sizeSel ? sizeSel.value : sizeInp?.value || '').trim(),
        qty:   Number(row.querySelector('.no-r-qty').value)   || 1,
        price: Number(row.querySelector('.no-r-price').value) || 0,
        cover: row.querySelector('.no-r-cover').value.trim(),
        id:    row.querySelector('.no-r-id').value.trim(),
      };
    }).filter(i => i.name);
  }

  function resetNewOrderForm() {
    newOrderForm.reset();
    noItemsTable.querySelectorAll('.no-item-row').forEach(r => r.remove());
    noRowCount = 0;
    addOrderRow();
    hideError(newOrderError);
    newOrderSuccess.classList.add('hidden');
    newOrderForm.classList.remove('hidden');
    document.getElementById('noCountry').value = 'DO';
    document.getElementById('noShipFee').value = '5';
  }

  function openNewOrder() {
    resetNewOrderForm();
    switchView('neworder');
  }

  noAddRowBtn?.addEventListener('click', () => addOrderRow());

  newOrderCancelBtn?.addEventListener('click', () => switchView('orders'));

  newOrderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(newOrderError);

    const customer_name = document.getElementById('noName').value.trim();
    const customer_phone = document.getElementById('noPhone').value.trim();
    const country  = document.getElementById('noCountry').value.trim();
    const province = document.getElementById('noProvince').value.trim();
    const address  = document.getElementById('noAddress').value.trim();
    const shipping_fee   = document.getElementById('noShipFee').value;
    const payment_method = document.getElementById('noPayMethod').value;
    const tracking_stage = document.getElementById('noStage').value;
    const tracking_notes = document.getElementById('noNotes').value.trim();
    const items = getOrderItems();

    if (!customer_name) { showError(newOrderError, 'El nombre del cliente es obligatorio.'); return; }
    if (!items.length)  { showError(newOrderError, 'Agregá al menos un producto con nombre.'); return; }

    newOrderSubmitBtn.disabled = true;
    newOrderSubmitBtn.textContent = 'Creando...';

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          customer_name, customer_phone, country, province, address,
          items, shipping_fee, payment_method, tracking_stage, tracking_notes,
        }),
      });
      const data = await res.json();

      if (!res.ok) { showError(newOrderError, data.error || 'Error al crear el pedido.'); return; }

      // Show success card
      newOrderForm.classList.add('hidden');
      newOrderSuccess.classList.remove('hidden');
      document.getElementById('nosOrderNum').textContent = `Número de pedido: ${data.order_number}  ·  Código de tracking: ${data.tracking_code}`;
      const urlInput = document.getElementById('nosTrackUrl');
      urlInput.value = data.tracking_url;
      document.getElementById('nosOpenBtn').href = data.tracking_url;
      showToast('Pedido creado correctamente.');
    } catch {
      showError(newOrderError, 'Error de conexión.');
    } finally {
      newOrderSubmitBtn.disabled = false;
      newOrderSubmitBtn.textContent = 'Crear pedido';
    }
  });

  document.getElementById('nosCopyBtn')?.addEventListener('click', async () => {
    const val = document.getElementById('nosTrackUrl').value;
    try {
      await navigator.clipboard.writeText(val);
      const btn = document.getElementById('nosCopyBtn');
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 1600);
    } catch { showToast('No se pudo copiar.', true); }
  });

  document.getElementById('nosNewBtn')?.addEventListener('click', resetNewOrderForm);
  document.getElementById('nosOrdersBtn')?.addEventListener('click', () => switchView('orders'));

  // ─── Promo codes ─────────────────────────────────────────────────────────────
  const promoList          = document.getElementById('promoList');
  const showPromoFormBtn   = document.getElementById('showPromoFormBtn');
  const promoFormCard      = document.getElementById('promoFormCard');
  const promoFormTitle     = document.getElementById('promoFormTitle');
  const promoFormSaveBtn   = document.getElementById('promoFormSaveBtn');
  const promoFormCancelBtn = document.getElementById('promoFormCancelBtn');
  const promoFormError     = document.getElementById('promoFormError');
  const pfCode             = document.getElementById('pfCode');
  const pfPercent          = document.getElementById('pfPercent');
  const pfExpires          = document.getElementById('pfExpires');
  const pfActive           = document.getElementById('pfActive');
  const pfExcludeSearch    = document.getElementById('pfExcludeSearch');
  const pfExcludeDropdown  = document.getElementById('pfExcludeDropdown');
  const pfExcludedChips    = document.getElementById('pfExcludedChips');

  let editingPromoCode   = null;
  let excludedProducts   = [];  // [{ id, name }]
  let excludeSearchTimer = null;

  function resetPromoForm() {
    editingPromoCode = null;
    excludedProducts = [];
    pfCode.value    = '';
    pfCode.disabled = false;
    pfPercent.value = '';
    pfExpires.value = '';
    pfActive.checked = true;
    pfExcludedChips.innerHTML = '';
    pfExcludeSearch.value = '';
    pfExcludeDropdown.classList.add('hidden');
    promoFormError.classList.add('hidden');
    promoFormTitle.textContent = 'Nuevo código';
    promoFormCard.classList.remove('hidden');
  }

  function hidePromoForm() {
    promoFormCard.classList.add('hidden');
    editingPromoCode = null;
    excludedProducts = [];
  }

  function renderExcludedChips() {
    pfExcludedChips.innerHTML = excludedProducts.map(p => `
      <span class="promo-chip">
        ${escHtml(p.name)}
        <button class="promo-chip-remove" data-id="${p.id}" title="Quitar">×</button>
      </span>`).join('');
    pfExcludedChips.querySelectorAll('.promo-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        excludedProducts = excludedProducts.filter(p => p.id !== Number(btn.dataset.id));
        renderExcludedChips();
      });
    });
  }

  async function loadPromos() {
    promoList.innerHTML = '<div class="table-loading">Cargando...</div>';
    try {
      const res  = await fetch('/api/admin/promos', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { promoList.innerHTML = `<div class="table-empty">${data.error || 'Error al cargar.'}</div>`; return; }
      renderPromos(data);
    } catch {
      promoList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  function renderPromos(promos) {
    if (!promos.length) {
      promoList.innerHTML = '<div class="table-empty">No hay códigos de descuento. Creá el primero.</div>';
      return;
    }
    promoList.innerHTML = `<table class="promo-table">
      <thead><tr>
        <th>Código</th><th>Descuento</th><th>Estado</th><th>Expira</th><th>Excluidos</th><th></th>
      </tr></thead>
      <tbody>
        ${promos.map(p => {
          const activeBadge = p.active
            ? `<span class="promo-badge promo-badge--active">Activo</span>`
            : `<span class="promo-badge promo-badge--inactive">Inactivo</span>`;
          const expires = p.expires_at
            ? new Date(p.expires_at).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' })
            : '—';
          const excCount = Array.isArray(p.excluded_product_ids) ? p.excluded_product_ids.length : 0;
          return `<tr>
            <td><strong>${escHtml(p.code)}</strong></td>
            <td>${p.percent}%</td>
            <td>${activeBadge}</td>
            <td>${expires}</td>
            <td>${excCount ? `${excCount} producto${excCount > 1 ? 's' : ''}` : '—'}</td>
            <td>
              <div class="promo-actions">
                <button class="btn btn-ghost btn-sm" data-promo-edit="${escHtml(p.code)}">Editar</button>
                <button class="btn btn-ghost btn-sm" data-promo-toggle="${escHtml(p.code)}" data-active="${p.active}">
                  ${p.active ? 'Desactivar' : 'Activar'}
                </button>
                <button class="btn btn-danger btn-sm" data-promo-delete="${escHtml(p.code)}">Eliminar</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  // Delegated click handlers on promoList
  promoList?.addEventListener('click', async e => {
    const editBtn   = e.target.closest('[data-promo-edit]');
    const toggleBtn = e.target.closest('[data-promo-toggle]');
    const deleteBtn = e.target.closest('[data-promo-delete]');

    if (editBtn) {
      const code = editBtn.dataset.promoEdit;
      await openEditPromo(code);
    }
    if (toggleBtn) {
      const code   = toggleBtn.dataset.promoToggle;
      const active = toggleBtn.dataset.active === '1';
      if (!confirm(`¿${active ? 'Desactivar' : 'Activar'} el código ${code}?`)) return;
      try {
        const res = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ active: !active }),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error', true); return; }
        showToast(`Código ${code} ${active ? 'desactivado' : 'activado'}.`);
        loadPromos();
      } catch { showToast('Error de conexión.', true); }
    }
    if (deleteBtn) {
      const code = deleteBtn.dataset.promoDelete;
      if (!confirm(`¿Eliminar el código ${code}? Esta acción no se puede deshacer.`)) return;
      try {
        const res = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error', true); return; }
        showToast(`Código ${code} eliminado.`);
        loadPromos();
      } catch { showToast('Error de conexión.', true); }
    }
  });

  async function openEditPromo(code) {
    try {
      const res  = await fetch('/api/admin/promos', { headers: authHeaders() });
      const data = await res.json();
      const promo = data.find(p => p.code === code);
      if (!promo) { showToast('Código no encontrado.', true); return; }

      editingPromoCode     = promo.code;
      excludedProducts     = [];
      pfCode.value         = promo.code;
      pfCode.disabled      = true;
      pfPercent.value      = promo.percent;
      pfActive.checked     = !!promo.active;
      pfExpires.value      = promo.expires_at
        ? promo.expires_at.slice(0, 16)
        : '';
      promoFormTitle.textContent = `Editar código: ${promo.code}`;

      // Load excluded product names
      if (promo.excluded_product_ids?.length) {
        const productRes = await fetch(`/api/products?page=1&limit=200`, { headers: authHeaders() });
        const productData = await productRes.json();
        const productMap = {};
        (productData.products || []).forEach(p => { productMap[p.id] = p.name; });
        excludedProducts = promo.excluded_product_ids.map(id => ({
          id, name: productMap[id] || `Producto #${id}`,
        }));
      }
      renderExcludedChips();
      promoFormError.classList.add('hidden');
      promoFormCard.classList.remove('hidden');
      promoFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { showToast('Error al cargar el código.', true); }
  }

  showPromoFormBtn?.addEventListener('click', () => {
    if (!promoFormCard.classList.contains('hidden') && !editingPromoCode) {
      hidePromoForm();
    } else {
      resetPromoForm();
      promoFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  promoFormCancelBtn?.addEventListener('click', hidePromoForm);

  promoFormSaveBtn?.addEventListener('click', async () => {
    promoFormError.classList.add('hidden');
    const code    = (pfCode.value || '').trim().toUpperCase();
    const percent = Number(pfPercent.value);
    const active  = pfActive.checked;
    const expires = pfExpires.value ? new Date(pfExpires.value).toISOString() : null;
    const excludedIds = excludedProducts.map(p => p.id);

    if (!code) { showError(promoFormError, 'El código no puede estar vacío.'); return; }
    if (!percent || percent < 1 || percent > 100) {
      showError(promoFormError, 'El descuento debe ser entre 1 y 100.'); return;
    }

    promoFormSaveBtn.disabled = true;
    promoFormSaveBtn.textContent = 'Guardando...';
    try {
      const url    = editingPromoCode
        ? `/api/admin/promos/${encodeURIComponent(editingPromoCode)}`
        : '/api/admin/promos';
      const method = editingPromoCode ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ code, percent, active, expires_at: expires, excluded_product_ids: excludedIds }),
      });
      const data = await res.json();
      if (!res.ok) { showError(promoFormError, data.error || 'Error al guardar.'); return; }
      showToast(editingPromoCode ? 'Código actualizado.' : 'Código creado.');
      hidePromoForm();
      loadPromos();
    } catch { showError(promoFormError, 'Error de conexión.'); }
    finally { promoFormSaveBtn.disabled = false; promoFormSaveBtn.textContent = 'Guardar'; }
  });

  // Product exclusion search
  let allProductsForExclude = null;

  async function ensureProductsForExclude() {
    if (allProductsForExclude) return allProductsForExclude;
    const res  = await fetch('/api/products?page=1&limit=500', { headers: authHeaders() });
    const data = await res.json();
    allProductsForExclude = data.products || [];
    return allProductsForExclude;
  }

  pfExcludeSearch?.addEventListener('input', () => {
    clearTimeout(excludeSearchTimer);
    excludeSearchTimer = setTimeout(async () => {
      const q = pfExcludeSearch.value.trim().toLowerCase();
      if (!q) { pfExcludeDropdown.classList.add('hidden'); return; }
      try {
        const products = await ensureProductsForExclude();
        const matches  = products.filter(p =>
          p.name.toLowerCase().includes(q) &&
          !excludedProducts.some(ex => ex.id === p.id)
        ).slice(0, 12);
        if (!matches.length) { pfExcludeDropdown.classList.add('hidden'); return; }
        pfExcludeDropdown.innerHTML = matches.map(p =>
          `<div class="promo-exclude-dropdown-item" data-id="${p.id}" data-name="${escHtml(p.name)}">${escHtml(p.name)}</div>`
        ).join('');
        pfExcludeDropdown.classList.remove('hidden');
      } catch { pfExcludeDropdown.classList.add('hidden'); }
    }, 220);
  });

  pfExcludeDropdown?.addEventListener('click', e => {
    const item = e.target.closest('.promo-exclude-dropdown-item');
    if (!item) return;
    excludedProducts.push({ id: Number(item.dataset.id), name: item.dataset.name });
    renderExcludedChips();
    pfExcludeSearch.value = '';
    pfExcludeDropdown.classList.add('hidden');
    pfExcludeSearch.focus();
  });

  // ─── Brand promo rules (Descuentos) ──────────────────────────────────────────
  const brandPromoRulesList    = document.getElementById('brandPromoRulesList');
  const brandPromoRulesSaveBtn = document.getElementById('brandPromoRulesSaveBtn');
  const brandPromoRulesError   = document.getElementById('brandPromoRulesError');
  let brandPromoRulesDraft     = [];

  async function loadBrandPromoRules() {
    if (!brandPromoRulesList) return;
    brandPromoRulesList.innerHTML = '<div class="table-loading">Cargando...</div>';
    brandPromoRulesError?.classList.add('hidden');
    try {
      const res  = await fetch('/api/admin/brands/promo-rules', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        brandPromoRulesList.innerHTML = `<div class="table-empty">${data.error || 'Error al cargar.'}</div>`;
        return;
      }
      brandPromoRulesDraft = data.map(b => ({
        id: b.id,
        name: b.name,
        product_count: b.product_count,
        promo_excluded: !!b.promo_excluded,
        promo_min_price_usd: b.promo_min_price_usd != null ? b.promo_min_price_usd : '',
      }));
      renderBrandPromoRules();
    } catch {
      brandPromoRulesList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  function renderBrandPromoRules() {
    if (!brandPromoRulesList) return;
    if (!brandPromoRulesDraft.length) {
      brandPromoRulesList.innerHTML = '<div class="table-empty">No hay marcas. Creá marcas en la sección Marcas y asignalas a tus productos.</div>';
      return;
    }
    brandPromoRulesList.innerHTML = `<table class="promo-table brand-promo-rules-table">
      <thead><tr>
        <th>Marca</th>
        <th>Productos</th>
        <th>Sin cupón</th>
        <th>Precio mínimo (USD)</th>
      </tr></thead>
      <tbody>
        ${brandPromoRulesDraft.map(b => `
          <tr data-brand-rule-id="${b.id}">
            <td><strong>${escHtml(b.name)}</strong></td>
            <td>${b.product_count || 0}</td>
            <td>
              <label class="promo-toggle-label">
                <input type="checkbox" class="brand-rule-excluded" data-id="${b.id}" ${b.promo_excluded ? 'checked' : ''} />
                <span>No aplica</span>
              </label>
            </td>
            <td>
              <input type="number" class="brand-rule-min admin-input-inline"
                data-id="${b.id}" min="1" step="0.01" placeholder="Ej: 350"
                value="${b.promo_excluded ? '' : (b.promo_min_price_usd !== '' ? escHtml(String(b.promo_min_price_usd)) : '')}"
                ${b.promo_excluded ? 'disabled' : ''} />
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

    brandPromoRulesList.querySelectorAll('.brand-rule-excluded').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = Number(cb.dataset.id);
        const row = brandPromoRulesDraft.find(r => r.id === id);
        if (!row) return;
        row.promo_excluded = cb.checked;
        const minInput = brandPromoRulesList.querySelector(`.brand-rule-min[data-id="${id}"]`);
        if (minInput) {
          minInput.disabled = cb.checked;
          if (cb.checked) minInput.value = '';
        }
      });
    });

    brandPromoRulesList.querySelectorAll('.brand-rule-min').forEach(input => {
      input.addEventListener('input', () => {
        const id = Number(input.dataset.id);
        const row = brandPromoRulesDraft.find(r => r.id === id);
        if (row) row.promo_min_price_usd = input.value;
      });
    });
  }

  brandPromoRulesSaveBtn?.addEventListener('click', async () => {
    brandPromoRulesError?.classList.add('hidden');
    brandPromoRulesList.querySelectorAll('.brand-rule-min').forEach(input => {
      const id = Number(input.dataset.id);
      const row = brandPromoRulesDraft.find(r => r.id === id);
      if (row && !row.promo_excluded) row.promo_min_price_usd = input.value;
    });
    brandPromoRulesList.querySelectorAll('.brand-rule-excluded').forEach(cb => {
      const id = Number(cb.dataset.id);
      const row = brandPromoRulesDraft.find(r => r.id === id);
      if (row) row.promo_excluded = cb.checked;
    });

    brandPromoRulesSaveBtn.disabled = true;
    brandPromoRulesSaveBtn.textContent = 'Guardando...';
    try {
      const res = await fetch('/api/admin/brands/promo-rules', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          rules: brandPromoRulesDraft.map(r => ({
            id: r.id,
            promo_excluded: r.promo_excluded,
            promo_min_price_usd: r.promo_excluded ? null : (r.promo_min_price_usd === '' ? null : r.promo_min_price_usd),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(brandPromoRulesError, data.error || 'Error al guardar.');
        return;
      }
      showToast('Límites por marca guardados.');
      loadBrandPromoRules();
    } catch {
      showError(brandPromoRulesError, 'Error de conexión.');
    } finally {
      brandPromoRulesSaveBtn.disabled = false;
      brandPromoRulesSaveBtn.textContent = 'Guardar límites';
    }
  });

  document.addEventListener('click', e => {
    if (!pfExcludeDropdown?.contains(e.target) && e.target !== pfExcludeSearch) {
      pfExcludeDropdown?.classList.add('hidden');
    }
  });

  // ─── Selección de Calziani ────────────────────────────────────────────────────
  let seleccionItems = []; // { id, name, price, cover, category }
  let seleccionSearchTimer = null;
  let seleccionDragIdx = null;

  const seleccionList      = document.getElementById('seleccionList');
  const seleccionCount     = document.getElementById('seleccionCount');
  const seleccionSaveBtn   = document.getElementById('seleccionSaveBtn');
  const seleccionSearch    = document.getElementById('seleccionSearch');
  const seleccionResults   = document.getElementById('seleccionSearchResults');

  async function loadSeleccion() {
    if (!seleccionList) return;
    seleccionList.innerHTML = '<div class="table-loading">Cargando...</div>';
    try {
      const res  = await fetch('/api/featured', { headers: authHeaders() });
      const data = await res.json();
      seleccionItems = data.map(p => ({
        id: p.id, name: p.name, price: p.price,
        cover: p.cover, category: p.category,
      }));
      renderSeleccionList();
    } catch {
      seleccionList.innerHTML = '<div class="table-loading">Error al cargar.</div>';
    }
  }

  function renderSeleccionList() {
    if (!seleccionList) return;
    seleccionCount.textContent = `${seleccionItems.length} producto${seleccionItems.length !== 1 ? 's' : ''} seleccionado${seleccionItems.length !== 1 ? 's' : ''}`;
    if (!seleccionItems.length) {
      seleccionList.innerHTML = '<div class="seleccion-empty">No hay productos en la selección. Buscá arriba para agregar.</div>';
      return;
    }
    seleccionList.innerHTML = seleccionItems.map((p, i) => {
      const imgHtml = p.cover
        ? `<img src="/img/products/${escHtml(p.cover)}" class="seleccion-item-img" alt="${escHtml(p.name)}" />`
        : `<div class="seleccion-item-img"></div>`;
      return `<div class="seleccion-item" draggable="true" data-idx="${i}">
        <span class="seleccion-drag-handle" title="Arrastrar para reordenar">⠿</span>
        <span class="seleccion-item-pos">${i + 1}</span>
        ${imgHtml}
        <div class="seleccion-item-info">
          <div class="seleccion-item-name">${escHtml(p.name)}</div>
          <div class="seleccion-item-meta">${CAT_LABELS[p.category] || p.category} · ${formatPrice(p.price)}</div>
        </div>
        <button class="seleccion-item-remove" data-idx="${i}" title="Quitar de la selección">✕</button>
      </div>`;
    }).join('');

    seleccionList.querySelectorAll('.seleccion-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        seleccionItems.splice(idx, 1);
        renderSeleccionList();
      });
    });

    // Drag-and-drop reorder
    seleccionList.querySelectorAll('.seleccion-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        seleccionDragIdx = Number(el.dataset.idx);
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        seleccionList.querySelectorAll('.seleccion-item').forEach(i => i.classList.remove('drag-over'));
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        seleccionList.querySelectorAll('.seleccion-item').forEach(i => i.classList.remove('drag-over'));
        el.classList.add('drag-over');
      });
      el.addEventListener('drop', e => {
        e.preventDefault();
        const targetIdx = Number(el.dataset.idx);
        if (seleccionDragIdx === null || seleccionDragIdx === targetIdx) return;
        const [moved] = seleccionItems.splice(seleccionDragIdx, 1);
        seleccionItems.splice(targetIdx, 0, moved);
        seleccionDragIdx = null;
        renderSeleccionList();
      });
    });
  }

  async function seleccionSearchProducts(q) {
    if (!q.trim()) { seleccionResults?.classList.add('hidden'); return; }
    try {
      const res  = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=30`, { headers: authHeaders() });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.products || []);
      if (!seleccionResults) return;
      if (!list.length) {
        seleccionResults.innerHTML = '<div class="seleccion-result-item" style="color:#aaa">Sin resultados</div>';
        seleccionResults.classList.remove('hidden');
        return;
      }
      seleccionResults.innerHTML = list.map(p => {
        const alreadyIn = seleccionItems.some(s => s.id === p.id);
        const imgHtml = p.cover
          ? `<img src="/img/products/${escHtml(p.cover)}" class="seleccion-result-img" alt="" />`
          : `<div class="seleccion-result-img"></div>`;
        return `<div class="seleccion-result-item${alreadyIn ? ' already-added' : ''}" data-id="${p.id}" data-name="${escHtml(p.name)}" data-price="${p.price}" data-cover="${escHtml(p.cover || '')}" data-cat="${escHtml(p.category)}">
          ${imgHtml}
          <span class="seleccion-result-name">${escHtml(p.name)}</span>
          <span class="seleccion-result-price">${formatPrice(p.price)}</span>
          ${alreadyIn ? '<span class="seleccion-result-tag">ya agregado</span>' : ''}
        </div>`;
      }).join('');
      seleccionResults.classList.remove('hidden');

      seleccionResults.querySelectorAll('.seleccion-result-item:not(.already-added)').forEach(row => {
        row.addEventListener('click', () => {
          const item = {
            id: Number(row.dataset.id),
            name: row.dataset.name,
            price: Number(row.dataset.price),
            cover: row.dataset.cover || null,
            category: row.dataset.cat,
          };
          if (!seleccionItems.some(s => s.id === item.id)) {
            seleccionItems.push(item);
            renderSeleccionList();
          }
          if (seleccionSearch) seleccionSearch.value = '';
          seleccionResults?.classList.add('hidden');
        });
      });
    } catch {
      seleccionResults?.classList.add('hidden');
    }
  }

  seleccionSearch?.addEventListener('input', () => {
    clearTimeout(seleccionSearchTimer);
    seleccionSearchTimer = setTimeout(() => seleccionSearchProducts(seleccionSearch.value), 320);
  });

  document.addEventListener('click', e => {
    if (!seleccionResults?.contains(e.target) && e.target !== seleccionSearch) {
      seleccionResults?.classList.add('hidden');
    }
  });

  seleccionSaveBtn?.addEventListener('click', async () => {
    seleccionSaveBtn.disabled = true;
    seleccionSaveBtn.textContent = 'Guardando...';
    try {
      const res = await fetch('/api/admin/featured', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ids: seleccionItems.map(p => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al guardar.', true); return; }
      showToast('Selección de Calziani guardada.');
    } catch {
      showToast('Error de conexión.', true);
    } finally {
      seleccionSaveBtn.disabled = false;
      seleccionSaveBtn.textContent = 'Guardar selección';
    }
  });

  // ─── Init ────────────────────────────────────────────────────────────────────
  checkAuth();
})();
