(() => {
  // ─── State ─────────────────────────────────────────────────────────────────
  let token = sessionStorage.getItem('calziani_token') || null;
  let pendingDeleteId = null;
  let searchTimer = null;

  const CAT_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };

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

  const productForm    = document.getElementById('productForm');
  const formTitle      = document.getElementById('formTitle');
  const editId         = document.getElementById('editId');
  const fName          = document.getElementById('fName');
  const fCategory      = document.getElementById('fCategory');
  const fPrice         = document.getElementById('fPrice');
  const fStock         = document.getElementById('fStock');
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
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p);
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

  // ─── Size checkboxes ────────────────────────────────────────────────────────
  function renderSizeCheckboxes(category, selected = []) {
    const sizes = SIZES_BY_CATEGORY[category];

    if (!sizes) {
      sizesContainer.innerHTML = '';
      sizesHint.classList.remove('hidden');
      return;
    }

    sizesHint.classList.add('hidden');
    sizesContainer.innerHTML = sizes.map(s => {
      const checked = selected.includes(s) ? 'checked' : '';
      return `<label class="size-checkbox">
        <input type="checkbox" value="${s}" ${checked} />
        <span>${s}</span>
      </label>`;
    }).join('');
  }

  function getSelectedSizes() {
    return [...sizesContainer.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
  }

  fCategory.addEventListener('change', () => {
    renderSizeCheckboxes(fCategory.value, []);
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

  // ─── Product Form ────────────────────────────────────────────────────────────
  function resetForm() {
    editId.value = '';
    productForm.reset();
    fStock.value = '0';
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
      fStock.value = p.stock;
      fDesc.value = p.description || '';
      fComparePrice.value = p.compare_price || '';
      fShipping.value = p.shipping_days || '';
      renderSizeCheckboxes(p.category, Array.isArray(p.sizes) ? p.sizes : []);
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
    const stock = fStock.value;
    const description = fDesc.value.trim();
    const sizes = getSelectedSizes();
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
    formData.append('stock', stock || '0');
    formData.append('description', description);
    formData.append('sizes', JSON.stringify(sizes));
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
