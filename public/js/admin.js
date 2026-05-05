(() => {
  // ─── State ─────────────────────────────────────────────────────────────────
  let token = sessionStorage.getItem('calziani_token') || null;
  let pendingDeleteId = null;
  let searchTimer = null;

  const CAT_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };

  const ORDER_STATUS_LABEL = {
    pending_transfer: 'Pendiente (transferencia / WhatsApp)',
    pending_azul: 'Pendiente (tarjeta AZUL)',
    pending_paypal: 'Pendiente (PayPal)',
    paid_paypal: 'Pagado (PayPal)',
    paid: 'Pagado',
    cancelled: 'Cancelado',
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
    ropa:      ['XS','S','M','L','XL','XXL'],
    accesorio: ['Única talla'],
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
    if (name === 'orders') loadOrders();
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'new') openNew();
      else switchView(btn.dataset.view);
    });
  });

  // ─── Products list ───────────────────────────────────────────────────────────
  async function loadProducts() {
    adminList.innerHTML = '<div class="table-loading">Cargando...</div>';
    const cat = adminCatFilter.value;
    const q = adminSearch.value.trim();
    const params = new URLSearchParams();
    if (cat !== 'all') params.set('category', cat);
    if (q) params.set('search', q);

    try {
      const res = await fetch(`/api/products?${params}`);
      const products = await res.json();
      renderTable(products);
    } catch {
      adminList.innerHTML = '<div class="table-empty">Error al cargar productos.</div>';
    }
  }

  function renderTable(products) {
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

          return `<tr>
            <td class="td-img">${thumbHtml}</td>
            <td class="td-name"><span title="${escHtml(p.name)}">${escHtml(p.name)}</span></td>
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
    </table>`;

    adminList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit)));
    });
    adminList.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.delete)));
    });
  }

  adminSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadProducts, 350);
  });
  adminCatFilter.addEventListener('change', loadProducts);

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

  async function loadOrders() {
    if (!token || !ordersList) return;
    ordersList.innerHTML = '<div class="table-loading">Cargando pedidos...</div>';
    try {
      const res = await fetch('/api/admin/orders', { headers: authHeaders() });
      if (!res.ok) {
        ordersList.innerHTML = '<div class="table-empty">No se pudieron cargar los pedidos.</div>';
        return;
      }
      const orders = await res.json();
      renderOrders(orders);
    } catch {
      ordersList.innerHTML = '<div class="table-empty">Error de conexión.</div>';
    }
  }

  function renderOrders(orders) {
    if (!orders.length) {
      ordersList.innerHTML = '<div class="table-empty">No hay pedidos registrados.</div>';
      return;
    }
    ordersList.innerHTML = orders.map(renderOrderCard).join('');
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
          <p>${escHtml(ship.name)} · ${escHtml(ship.phone)}</p>
          <p>${escHtml(ship.country)} — ${escHtml(ship.province)}</p>
          <p>${escHtml(ship.address)}</p>
        </div>`
      : '<div class="order-card__section"><p class="order-muted">Sin datos de envío en el pedido.</p></div>';

    const itemsHtml = cart.length
      ? `<ul class="order-card__items">${cart.map(i => {
          const line = Number(i.price) * Number(i.qty);
          const sz = i.size ? ` <small>(${escHtml(i.size)})</small>` : '';
          return `<li><span class="order-card__iname">${escHtml(i.name)}${sz}</span> <span class="order-card__iqty">×${i.qty}</span> <span class="order-card__iprice">${formatPrice(line)}</span></li>`;
        }).join('')}</ul>`
      : '<p class="order-muted">Sin detalle de productos en JSON.</p>';

    const st = o.status || '';
    const currentStage = o.tracking_stage || 'received';
    const tCode = o.tracking_code || '—';

    const stageOptions = TRACKING_STAGES.map(s =>
      `<option value="${s}" ${s === currentStage ? 'selected' : ''}>${TRACKING_STAGE_LABEL[s] || s}</option>`
    ).join('');

    const trackingBlock = `
      <div class="order-card__section order-card__tracking">
        <h4 class="order-card__h">Tracking</h4>
        <div class="tracking-admin-row">
          <div class="tracking-code-display">
            <span class="tracking-code-label">Código del cliente:</span>
            <code class="tracking-code-val" id="tcode-${o.id}">${escHtml(tCode)}</code>
            ${tCode !== '—'
              ? `<button type="button" class="btn-copy-code" data-code="${escHtml(tCode)}" title="Copiar código">⎘</button>`
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
      const stageEl = document.getElementById(`stage-${orderId}`);
      const notesEl = document.getElementById(`notes-${orderId}`);
      const feedback = document.getElementById(`tsave-${orderId}`);
      if (!stageEl) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            tracking_stage: stageEl.value,
            tracking_notes: notesEl?.value || '',
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          showToast(d.error || 'Error al guardar.', true);
        } else {
          feedback?.classList.remove('hidden');
          setTimeout(() => feedback?.classList.add('hidden'), 2500);
          // Update the badge in the card header
          const card = saveBtn.closest('.order-card');
          const badge = card?.querySelector('.order-card__tracking-badge');
          if (badge) {
            badge.textContent = TRACKING_STAGE_LABEL[stageEl.value] || stageEl.value;
            badge.className = `order-card__tracking-badge order-card__tracking-badge--${stageEl.value}`;
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
  });

  // ─── Product Form ────────────────────────────────────────────────────────────
  function resetForm() {
    editId.value = '';
    productForm.reset();
    hideError(formError);
    formTitle.textContent = 'Nuevo producto';
    formSubmitBtn.textContent = 'Guardar producto';
    sizesContainer.innerHTML = '';
    sizesHint.classList.remove('hidden');
    offerBadgePreview.classList.remove('visible');
    resetImages();
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
      renderSizeStockInputs(p.category, Array.isArray(p.sizes) ? p.sizes : [], p.sizes_stock || {});
      updateOfferPreview();
      existingImages = Array.isArray(p.images) ? p.images : [];
      newFiles = [];
      removeIds = [];
      renderImgGrid();
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

  // ─── Init ────────────────────────────────────────────────────────────────────
  checkAuth();
})();
