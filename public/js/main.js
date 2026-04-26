(() => {
  const grid          = document.getElementById('productGrid');
  const sectionTitle  = document.getElementById('sectionTitle');
  const productCount  = document.getElementById('productCount');
  const searchInput   = document.getElementById('searchInput');
  const navBtns       = document.querySelectorAll('.nav-btn');
  const sizeFilterBar = document.getElementById('sizeFilterBar');
  const sizeFilterBtns= document.getElementById('sizeFilterBtns');

  let currentCategory = 'all';
  let currentSize     = 'all';
  let searchTimer     = null;

  const CATEGORY_LABELS = { calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorio' };
  const TITLE_MAP = {
    all: 'Todos los productos', calzado: 'Calzado', ropa: 'Ropa', accesorio: 'Accesorios',
  };
  const SIZES_BY_CATEGORY = {
    calzado:   ['35','36','37','38','39','40','41','42','43','44','45'],
    ropa:      ['XS','S','M','L','XL','XXL'],
    accesorio: ['Única talla'],
  };

  function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price);
  }

  function stockLabel(stock) {
    if (stock === 0) return { text: 'Sin stock', cls: 'out' };
    if (stock <= 5)  return { text: `Últimas ${stock} unidades`, cls: 'low' };
    return { text: 'Disponible', cls: '' };
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Size filter bar ────────────────────────────────────────────────────────
  function renderSizeFilter(category) {
    const sizes = category !== 'all' ? SIZES_BY_CATEGORY[category] : null;
    if (!sizes) { sizeFilterBar.classList.add('hidden'); currentSize = 'all'; return; }

    sizeFilterBar.classList.remove('hidden');
    sizeFilterBtns.innerHTML =
      `<button class="size-btn${currentSize === 'all' ? ' active' : ''}" data-size="all">Todos</button>` +
      sizes.map(s => `<button class="size-btn${currentSize === s ? ' active' : ''}" data-size="${s}">${s}</button>`).join('');

    sizeFilterBtns.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSize = btn.dataset.size;
        sizeFilterBtns.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetchProducts(currentCategory, searchInput.value, currentSize);
      });
    });
  }

  // ─── Fetch & render ─────────────────────────────────────────────────────────
  async function fetchProducts(category = 'all', search = '', size = 'all') {
    grid.innerHTML = '<div class="loading">Cargando...</div>';
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search.trim()) params.set('search', search.trim());
    if (size !== 'all') params.set('size', size);

    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      renderProducts(await res.json());
    } catch {
      grid.innerHTML = '<div class="empty-state"><span class="empty-state__icon">!</span>Error al cargar productos.</div>';
    }
  }

  function renderProducts(products) {
    sectionTitle.textContent = TITLE_MAP[currentCategory] || 'Productos';
    productCount.textContent = products.length
      ? `${products.length} resultado${products.length !== 1 ? 's' : ''}` : '';

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-state__icon">—</span>No hay productos en esta categoría aún.</div>`;
      return;
    }

    grid.innerHTML = products.map(p => {
      const isOffer  = p.compare_price && p.compare_price > p.price;
      const discount = isOffer ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
      const sl       = stockLabel(p.stock);

      const imgHtml = p.cover
        ? `<img src="/img/products/${p.cover}" alt="${escHtml(p.name)}" class="product-card__img" loading="lazy" />`
        : `<div class="product-card__img-empty"><span>CALZIANI</span></div>`;

      const badgeHtml = isOffer
        ? `<span class="product-card__sale-badge">−${discount}%</span>`
        : (sl.cls === 'out' ? `<span class="product-card__stock-badge out">Sin stock</span>` : '');

      const priceHtml = isOffer
        ? `<span class="pc-price pc-price--sale">${formatPrice(p.price)}</span><span class="pc-price-orig">${formatPrice(p.compare_price)}</span>`
        : `<span class="pc-price">${formatPrice(p.price)}</span>`;

      return `<a class="product-card" href="/product/${p.id}" aria-label="Ver ${escHtml(p.name)}">
        <div class="product-card__media">
          ${imgHtml}
          ${badgeHtml}
        </div>
        <div class="product-card__info">
          <p class="pc-category">${CATEGORY_LABELS[p.category] || p.category}</p>
          <h3 class="pc-name">${escHtml(p.name)}</h3>
          <div class="pc-pricing">${priceHtml}</div>
          ${p.sizes && p.sizes.length ? `<div class="pc-sizes">${p.sizes.map(s => `<span class="pc-size">${s}</span>`).join('')}</div>` : ''}
        </div>
      </a>`;
    }).join('');
  }

  // ─── Category nav ────────────────────────────────────────────────────────────
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      currentSize = 'all';
      renderSizeFilter(currentCategory);
      fetchProducts(currentCategory, searchInput.value, currentSize);
    });
  });

  // ─── Search ──────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchProducts(currentCategory, searchInput.value, currentSize), 350);
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  const authModal      = document.getElementById('authModal');
  const authBackdrop   = document.getElementById('authBackdrop');
  const authModalClose = document.getElementById('authModalClose');
  const headerUser     = document.getElementById('headerUser');
  const userDropdown   = document.getElementById('userDropdown');
  const logoutBtn      = document.getElementById('logoutBtn');
  const authTabs       = document.querySelectorAll('.auth-tab');
  const authPanels     = document.querySelectorAll('.auth-panel');
  const loginError     = document.getElementById('loginError');
  const registerError  = document.getElementById('registerError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const regSubmitBtn   = document.getElementById('regSubmitBtn');
  const authBrandSub   = document.getElementById('authBrandSub');

  let currentUser  = null;

  function showAuthError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
  function hideAuthError(el) { el.classList.add('hidden'); }

  function openAuthModal(tab = 'login') {
    switchAuthTab(tab);
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (loginError) hideAuthError(loginError);
    if (registerError) hideAuthError(registerError);
    document.getElementById('loginEmail')?.value && (document.getElementById('loginEmail').value = '');
    document.getElementById('loginPassword')?.value && (document.getElementById('loginPassword').value = '');
    document.getElementById('regName')?.value && (document.getElementById('regName').value = '');
    document.getElementById('regEmail')?.value && (document.getElementById('regEmail').value = '');
    document.getElementById('regPassword')?.value && (document.getElementById('regPassword').value = '');
  }

  const BRAND_SUBS = { login: 'Bienvenido de nuevo', register: 'Creá tu cuenta gratis', forgot: 'Recuperar contraseña' };
  const tabsContainer = document.querySelector('.auth-tabs');

  function switchAuthTab(tab) {
    const isMeta = tab === 'forgot'; // panels that hide the tab bar
    if (tabsContainer) tabsContainer.classList.toggle('hidden', isMeta);
    authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    authPanels.forEach(p => {
      p.classList.toggle('active', p.id === `panel${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });
    if (authBrandSub) authBrandSub.textContent = BRAND_SUBS[tab] || '';
  }

  authTabs.forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));

  document.querySelectorAll('.auth-link-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.dataset.to && switchAuthTab(btn.dataset.to));
  });

  // Forgot password
  document.getElementById('forgotBtn')?.addEventListener('click', () => switchAuthTab('forgot'));

  const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
  const forgotError     = document.getElementById('forgotError');
  const forgotSuccess   = document.getElementById('forgotSuccess');

  forgotSubmitBtn?.addEventListener('click', async () => {
    if (forgotError) hideAuthError(forgotError);
    if (forgotSuccess) forgotSuccess.classList.add('hidden');
    const email = document.getElementById('forgotEmail')?.value.trim();
    if (!email) { showAuthError(forgotError, 'Ingresá tu email.'); return; }

    forgotSubmitBtn.disabled = true;
    forgotSubmitBtn.textContent = 'Enviando...';
    try {
      const res  = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(forgotError, data.error); return; }
      forgotSuccess.textContent = '¡Listo! Si ese email existe, revisá tu bandeja de entrada (también el spam).';
      forgotSuccess.classList.remove('hidden');
      forgotSubmitBtn.textContent = 'Enviado ✓';
    } catch { showAuthError(forgotError, 'Error de conexión.'); forgotSubmitBtn.textContent = 'Enviar enlace'; }
    finally { forgotSubmitBtn.disabled = false; }
  });

  document.getElementById('loginTrigger')?.addEventListener('click', () => openAuthModal('login'));
  authModalClose?.addEventListener('click', closeAuthModal);
  authBackdrop?.addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && authModal?.classList.contains('open')) closeAuthModal(); });

  // ─── Login submit ─────────────────────────────────────────────────────────────
  loginSubmitBtn?.addEventListener('click', async () => {
    hideAuthError(loginError);
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showAuthError(loginError, 'Completá todos los campos.'); return; }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Iniciando sesión...';
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(loginError, data.error); return; }
      setUserUI(data.user);
      closeAuthModal();
    } catch { showAuthError(loginError, 'Error de conexión.'); }
    finally { loginSubmitBtn.disabled = false; loginSubmitBtn.textContent = 'Iniciar sesión'; }
  });

  // ─── Register submit ──────────────────────────────────────────────────────────
  regSubmitBtn?.addEventListener('click', async () => {
    hideAuthError(registerError);
    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!name || !email || !password) { showAuthError(registerError, 'Completá todos los campos.'); return; }
    if (password.length < 6) { showAuthError(registerError, 'La contraseña debe tener al menos 6 caracteres.'); return; }

    regSubmitBtn.disabled = true;
    regSubmitBtn.textContent = 'Creando cuenta...';
    try {
      const res  = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (!res.ok) { showAuthError(registerError, data.error); return; }
      setUserUI(data.user);
      closeAuthModal();
    } catch { showAuthError(registerError, 'Error de conexión.'); }
    finally { regSubmitBtn.disabled = false; regSubmitBtn.textContent = 'Crear cuenta'; }
  });

  // ─── User UI ─────────────────────────────────────────────────────────────────
  function setUserUI(user) {
    currentUser = user;
    const loginTriggerEl = document.getElementById('loginTrigger');
    if (!user) {
      headerUser.innerHTML = `<button class="user-btn" id="loginTrigger">Iniciar sesión</button>`;
      document.getElementById('loginTrigger')?.addEventListener('click', () => openAuthModal('login'));
      return;
    }
    const initials  = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="user-avatar-img" alt="${escHtml(user.name)}" referrerpolicy="no-referrer" />`
      : `<span class="user-avatar-initials">${initials}</span>`;

    headerUser.innerHTML = `
      <button class="user-avatar-btn" id="userAvatarBtn" aria-label="Mi cuenta">
        <div class="user-avatar">${avatarHtml}</div>
        <span class="user-avatar-name">${escHtml(user.name.split(' ')[0])}</span>
      </button>`;

    document.getElementById('dropName').textContent  = user.name;
    document.getElementById('dropEmail').textContent = user.email;
    const dropAv = document.getElementById('dropAvatar');
    dropAv.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="" referrerpolicy="no-referrer" />`
      : `<span>${initials}</span>`;

    document.getElementById('userAvatarBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
      const rect = e.currentTarget.getBoundingClientRect();
      userDropdown.style.top   = (rect.bottom + 8) + 'px';
      userDropdown.style.right = (window.innerWidth - rect.right) + 'px';
    });
  }

  document.addEventListener('click', () => userDropdown?.classList.add('hidden'));

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    userDropdown.classList.add('hidden');
    setUserUI(null);
  });

  // ─── Google OAuth ─────────────────────────────────────────────────────────────
  document.getElementById('btnGoogle')?.addEventListener('click', () => { window.location.href = '/auth/google'; });

  async function checkGoogle() {
    try {
      const res  = await fetch('/api/auth/google-enabled');
      const data = await res.json();
      if (!data.enabled) {
        document.querySelectorAll('.btn-google').forEach(b => b.classList.add('hidden'));
        document.querySelectorAll('.auth-divider').forEach(d => d.classList.add('hidden'));
      }
    } catch { /* ignore */ }
  }

  // Handle redirect from Google OAuth
  if (new URLSearchParams(window.location.search).get('auth') === 'success') {
    history.replaceState(null, '', '/');
  }

  async function initAuth() {
    try {
      const res  = await fetch('/api/auth/me');
      const data = await res.json();
      setUserUI(data.user);
    } catch { setUserUI(null); }
    checkGoogle();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  renderSizeFilter(currentCategory);
  fetchProducts();
  initAuth();

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
