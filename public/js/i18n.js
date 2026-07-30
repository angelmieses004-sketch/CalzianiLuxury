// ─── Shared i18n engine (ES/EN) ───────────────────────────────────────────────
// Loaded before main.js / product.js on every customer-facing page.
window.CalzianiI18n = (function () {
  const T = {
    es: {
      // Header / nav
      announcement:       'ENVÍO MUNDIAL GRATUITO EN PEDIDOS +$150',
      cat_all:             'Todo',
      cat_calzado:         'Calzado',
      search_placeholder:  'Buscar...',
      sign_in:              'Iniciar sesión',
      cat_label_calzado:   'Calzado',
      title_all:            'Todos los productos',
      title_calzado:        'Calzado',

      // Hero
      hero_eyebrow:  'Est. Santiago, RD',
      hero_title:    'Lujo que<br>se camina.',
      hero_sub:      'Calzado de marca verificado como auténtico. Coordinamos la entrega por WhatsApp hasta tu puerta.',
      hero_cta:      'Explorar colección',
      hero_cta_ghost:'Ver calzado',
      hero_follow:   'Seguinos',
      hero_authentic:'Auténtico',
      hero_tag_sub:  '100% original<br>Envío mundial',
      hero_colors:   'Colores populares',
      hero_happy:    '+300 clientes felices',
      hero_see_reviews: 'Ver reseñas →',
      hero_ship_title:  'Envío mundial',
      hero_ship_sub:    'Gratis en pedidos +$150',

      // Trust strip
      trust_ship_title:    'Envío Mundial',
      trust_ship_sub:      'Gratis en pedidos +$150',
      trust_pay_title:     'Pago 100% Seguro',
      trust_pay_sub:       'SSL · 3D Secure · AZUL',
      trust_track_title:   'Tracking en Tiempo Real',
      trust_track_sub:     'Seguí tu pedido al instante',
      trust_auth_title:    'Productos Auténticos',
      trust_auth_sub:      'Marcas certificadas',

      brand_strip_label: 'Marcas que vendemos',

      // Sale strip / section
      sale_title:          'Selección especial — piezas a precios exclusivos',
      sale_cta:             'Ver →',
      sale_products_title: 'Ofertas',
      loading:              'Cargando...',
      loading_products:    'Cargando productos...',
      all_products:         'Todos los productos',
      size_label:            'Talle',

      // Social proof bar
      proof_text:  '<strong>4.9</strong> · +300 clientes satisfechos',
      proof_brands:'Golden Goose · Lacoste · Polo Ralph Lauren',
      proof_cta:    'Ver reseñas →',

      seleccion_title: 'Selección de Calziani',

      // Newsletter
      newsletter_eyebrow: 'ACCESO EXCLUSIVO',
      newsletter_title:   'Sé el primero en ver los nuevos drops',
      newsletter_sub:     'Ofertas exclusivas, nuevas llegadas y contenido para miembros. Sin spam.',
      newsletter_placeholder: 'Tu correo electrónico',
      newsletter_btn:      'Suscribirme',
      newsletter_success:  '¡Listo! Te avisamos con los próximos drops.',

      // Trust banner
      trust_banner_eyebrow: 'Confianza Calziani',
      trust_banner_title:   'Comprá con tranquilidad',
      trust_banner_sub:     'Más de 300 clientes felices ya confían en nosotros.',
      trust_banner_btn:     '¿Cómo confiar en nosotros?',

      // Footer
      footer_tagline:      'Moda luxury accesible.<br>Envío a todo el mundo.',
      footer_help_title:    'Ayuda',
      footer_link_about:    'Quiénes somos',
      footer_link_returns:  'Devoluciones y reembolsos',
      footer_link_shipping: 'Entrega y envío',
      footer_link_support:  'Servicio al cliente',
      footer_link_security: 'Seguridad',
      footer_contact_title: 'Contacto',
      footer_location:      'Santiago, Rep. Dominicana',
      footer_copy:          '© 2026 Todos los derechos reservados.',
      footer_privacy:       'Privacidad',
      footer_shipping:      'Envío',

      // Cart drawer
      ck_secure_payment:  'Pago seguro',
      ck_step_info:        'Información',
      ck_step_pay:          'Pago',
      ck_step_done:         'Confirmado',
      ck_empty:              'Tu carrito está vacío',
      ck_trust_original:    '✓ 100% original',
      ck_trust_pay_on_receipt: '✓ Pagás al recibir',
      ck_trust_rating:      '★ 4.9 · +300 clientes',
      ck_form_title:         'Tus datos',
      ck_field_name:          'Nombre completo',
      ck_field_name_ph:       'Ej. Juan Pérez',
      ck_field_phone:         'Teléfono (WhatsApp)',
      ck_field_phone_ph:      'Tu número personal',
      ck_field_address:       'Dirección',
      ck_field_address_ph:    'Ciudad, provincia',
      ck_field_hint:           'Necesitamos tu número personal para coordinar la entrega por WhatsApp.',
      ck_field_err:            'Completá todos los datos para continuar.',
      ck_promo_ph:              'Código de descuento',
      ck_promo_apply:           'Aplicar',
      ck_promo_clear:           '✕ Quitar código',
      ck_info_box:  'Apartás con el <strong>30%</strong> y pagás el resto <strong>al recibir</strong>. Te contactamos por WhatsApp para coordinar la entrega.',
      ck_subtotal:  'Subtotal',
      ck_discount:   'Descuento',
      ck_shipping:   'Envío prioritario',
      ck_total:       'Total',
      ck_deposit_label: 'Apartás hoy (30%)',
      ck_cta:            'Confirmar mi pedido',
      ck_cta_sub:        'Sin pagar ahora · coordinamos por WhatsApp',
      ck_back:            'Volver',
      ck_pay_title:       'Ingresá el método de pago',
      ck_method_label:    'Seleccioná un método',
      ck_method_card:      'Tarjeta',
      ck_method_transfer:  'Transferencia',
      ck_method_cod:        'Al recibir',
      ck_cardlink_note:    'Recibirás un link de pago seguro por WhatsApp para completar tu compra con tarjeta débito/crédito.',
      ck_cardlink_btn:      'Solicitar link de pago',
      ck_whatsapp_btn:      'Confirmar por WhatsApp',
      ck_cod_note:  'Opción disponible <strong>solo en Santiago</strong>. Un asesor coordinará la entrega y el cobro.',
      ck_cod_btn:            'Confirmar pago al recibir',
      ck_pay_secure_label:  'Pago seguro con',
      ck_done_title:         '¡Pedido confirmado!',
      ck_done_sub:            'Te contactaremos por WhatsApp para coordinar la entrega.',
      ck_done_order:          'Pedido',
      ck_done_method:         'Método',
      ck_done_delivery:       'Entrega',
      ck_done_delivery_val:   'Coordinada por WhatsApp',
      ck_done_total:          'Total',
      ck_done_track:          'Ver seguimiento de pedido →',
      ck_done_continue:       'Seguir comprando',

      // Auth modal
      auth_welcome:      'Bienvenido de nuevo',
      auth_google:        'Continuar con Google',
      auth_or:             'o',
      auth_tab_login:      'Iniciar sesión',
      auth_tab_register:   'Crear cuenta',
      auth_email:           'Email',
      auth_email_ph:        'tu@email.com',
      auth_password:        'Contraseña',
      auth_password_ph:     '••••••••',
      auth_forgot:           '¿Olvidaste tu contraseña?',
      auth_login_submit:     'Iniciar sesión',
      auth_no_account:       '¿No tenés cuenta?',
      auth_create_free:      'Crear cuenta gratis',
      auth_back:              '← Volver',
      auth_recover_title:     'Recuperar contraseña',
      auth_recover_sub:       'Ingresá tu email y te enviamos un enlace para crear una nueva contraseña.',
      auth_your_email:        'Tu email',
      auth_send_link:          'Enviar enlace',
      auth_full_name:          'Nombre completo',
      auth_full_name_ph:       'Tu nombre',
      auth_min_chars_ph:       'Mínimo 6 caracteres',
      auth_min_chars_hint:     'Al menos 6 caracteres',
      auth_register_submit:    'Crear cuenta',
      auth_have_account:       '¿Ya tenés cuenta?',
      auth_logout:              'Cerrar sesión',

      // Size pick modal
      size_pick_title: 'Elegí talle',
      size_pick_sub:    'Tocá un talle para agregarlo al carrito.',

      // Terms modal
      terms_modal_title: 'Términos y condiciones',

      // Trust modal
      trust_modal_eyebrow: 'Calziani',
      trust_modal_title:    'Más de 300 clientes felices',
      trust_modal_tagline:  'Pioneros en vender lujo exclusivo y accesible en RD',
      trust_modal_gallery:  'Testimonios reales',
      trust_modal_loading:  'Cargando testimonios...',

      // Tracking dropdown
      trk_label:        'SEGUIMIENTO DE PEDIDO',
      trk_placeholder:   'Ej: CLZ-A1B2C3',
      trk_btn:            'Rastrear',
      trk_detail_link:    'Ver detalle →',

      // Product page
      pp_back:               '← Volver',
      pp_description:         'Descripción',
      pp_reviews_title:       'Opiniones de clientes',
      pp_write_review:        'Escribir reseña',
      pp_related_title:       'Te podría gustar',
      pp_add_to_cart:          'Agregar al carrito',
      pp_added:                 '¡Agregado! ✓',
      pp_buy_now:                'Comprar ahora',
      pp_out_of_stock:            'Sin stock',
      pp_available:                'Disponible',
      pp_low_stock:                'Quedan pocas unidades',
      pp_out_of_stock_size:        'Sin stock en este talle',
      pp_add_favorite:              'Agregar a favoritos',
      pp_in_favorite:                'En favoritos',
      pp_update_label:                'ACTUALIZACIÓN:',
      pp_update_text1:                'Estamos viralizándonos en redes sociales y tenemos muy pocas unidades disponibles.',
      pp_update_text2:                '¡Consíguelo ahora antes de que se agoten!',
      returns_title:      'Política de devoluciones',
      review_title:          'Dejá tu opinión',
      review_text_label:      'Tu reseña',
      review_text_ph:           'Contanos qué te pareció el producto...',
      review_name_label:        'Nombre',
      review_photo_label:       'Foto de tu compra',
      review_optional:          '(opcional)',
      review_choose_photo:      'Elegir foto',
      review_hint:               'JPG, PNG o WEBP · máx. 8 MB',
      review_submit:             'Publicar reseña',
      review_err_format:  'Formato no válido. Usá JPG, PNG o WEBP.',
      review_err_size:     'La imagen no puede superar 8 MB.',
      review_err_rating:    'Seleccioná una calificación.',
      review_err_length:     'La reseña debe tener al menos 10 caracteres.',
      review_err_name:        'Ingresá tu nombre.',
      review_err_generic:      'No se pudo publicar la reseña.',
      review_plural:             'reseñas',
      review_singular:            'reseña',
      review_be_first:             'Sé el primero en',
      review_be_first_link:         'opinar',
      review_default_customer:      'Cliente',
      review_photo_alt:             'Foto de compra de',

      breadcrumb_home:       'Inicio',
      pp_size_select_err:     'Seleccioná un talle para continuar.',
      pp_shipping_prefix:      'Envío:',
      pp_returns_title:         'Devoluciones fáciles',
      pp_returns_text:          'Si hay algún problema con tu pedido, te ayudamos a resolverlo de forma sencilla.',
      pp_returns_link:           'Ver política de devoluciones',
      pp_trust_authentic:        '100% Autenticidad garantizada',
      pp_trust_shipping:          'Envío mundial disponible',
      pp_trust_support:            'Atención personalizada 24/7',
      pp_not_found:                 'Producto no encontrado.',
      pp_back_to_store:              '← Volver a la tienda',
      pp_offer_ending_soon:          '🕐 Precio especial termina pronto',
      pp_offer_ends_in:               '🕐 Precio especial termina en',
      pp_urgency_prefix:               'Solo quedan',
      pp_urgency_suffix:                'en talla',
      pp_color_label:                  'Color',
      pp_additional_info:              'Información adicional',
      pp_size_guide_title:             'Guía de talles',
      pp_size_guide_text:              'Te recomendamos elegir tu talla habitual. Si estás entre dos talles, elegí la más grande.',
      pp_shipping_info_title:          'Envío y entrega',
      pp_shipping_info_text:           'Envío a todo el mundo. Coordinamos la entrega final por WhatsApp y podés hacer seguimiento en tiempo real desde "Rastrear pedido".',

      // Product card
      out_of_stock:      'Sin stock',
      stock_low_hint:     'Quedan pocas unidades',
      available:           'Disponible',
      add_to_cart:          'Agregar',
      terms_checkbox:       'Acepto los términos y condiciones de Calziani.',
      terms_read:            'Ver términos completos',
      terms_err:              'Debés aceptar los términos para continuar.',
      promo_label:              'Código de descuento',
      promo_apply:               'Aplicar',
      promo_remove:               'Quitar código',
      promo_discount_label:       'Descuento (−20%)',

      // Coupon popup
      cpn_badge:   'CÓDIGO LIMITADO',
      cpn_valid:    'VÁLIDO POR TIEMPO LIMITADO',
      cpn_week:      'Solo esta semana · cantidad limitada',
      cpn_ends_in:    '¡Termina en!',
      cpn_days:        'Días',
      cpn_hours:        'Hrs',
      cpn_mins:          'Min',
      cpn_secs:           'Seg',
      cpn_copy:            'COPIAR',
      cpn_trust:            'Pagás contra entrega en Santiago · Auténticos',
      cpn_fine:              '*No acumulable con otras promociones. Válido en todos los productos.',
    },
    en: {
      announcement:       'FREE WORLDWIDE SHIPPING ON ORDERS +$150',
      cat_all:             'All',
      cat_calzado:         'Footwear',
      search_placeholder:  'Search...',
      sign_in:              'Sign in',
      cat_label_calzado:   'Footwear',
      title_all:            'All products',
      title_calzado:        'Footwear',

      hero_eyebrow:  'Est. Santiago, DR',
      hero_title:    'Luxury made<br>to be worn.',
      hero_sub:      'Brand-name footwear verified authentic. We coordinate delivery over WhatsApp, right to your door.',
      hero_cta:      'Shop collection',
      hero_cta_ghost:'View footwear',
      hero_follow:   'Follow us',
      hero_authentic:'Authentic',
      hero_tag_sub:  '100% original<br>Worldwide shipping',
      hero_colors:   'Popular colors',
      hero_happy:    '+300 happy customers',
      hero_see_reviews: 'See reviews →',
      hero_ship_title:  'Worldwide shipping',
      hero_ship_sub:    'Free on orders +$150',

      trust_ship_title:    'Worldwide Shipping',
      trust_ship_sub:      'Free on orders +$150',
      trust_pay_title:     '100% Secure Payment',
      trust_pay_sub:       'SSL · 3D Secure · AZUL',
      trust_track_title:   'Real-Time Tracking',
      trust_track_sub:     'Track your order instantly',
      trust_auth_title:    'Authentic Products',
      trust_auth_sub:      'Certified brands',

      brand_strip_label: 'Brands we carry',

      sale_title:          'Special selection — exclusive prices',
      sale_cta:             'View →',
      sale_products_title: 'Sale',
      loading:              'Loading...',
      loading_products:    'Loading products...',
      all_products:         'All products',
      size_label:            'Size',

      proof_text:  '<strong>4.9</strong> · +300 satisfied customers',
      proof_brands:'Golden Goose · Lacoste · Polo Ralph Lauren',
      proof_cta:    'See reviews →',

      seleccion_title: 'Calziani Selection',

      newsletter_eyebrow: 'EXCLUSIVE ACCESS',
      newsletter_title:   'Be the first to see new drops',
      newsletter_sub:     'Exclusive deals, new arrivals, and member-only content. No spam.',
      newsletter_placeholder: 'Your email address',
      newsletter_btn:      'Subscribe',
      newsletter_success:  'Done! We\'ll let you know about upcoming drops.',

      trust_banner_eyebrow: 'Calziani Trust',
      trust_banner_title:   'Shop with confidence',
      trust_banner_sub:     'More than 300 happy customers already trust us.',
      trust_banner_btn:     'Why trust us?',

      footer_tagline:      'Accessible luxury fashion.<br>Worldwide shipping.',
      footer_help_title:    'Help',
      footer_link_about:    'About us',
      footer_link_returns:  'Returns and refunds',
      footer_link_shipping: 'Delivery and shipping',
      footer_link_support:  'Customer service',
      footer_link_security: 'Security',
      footer_contact_title: 'Contact',
      footer_location:      'Santiago, Dominican Republic',
      footer_copy:          '© 2026 All rights reserved.',
      footer_privacy:       'Privacy',
      footer_shipping:      'Shipping',

      ck_secure_payment:  'Secure checkout',
      ck_step_info:        'Info',
      ck_step_pay:          'Payment',
      ck_step_done:         'Confirmed',
      ck_empty:              'Your cart is empty',
      ck_trust_original:    '✓ 100% authentic',
      ck_trust_pay_on_receipt: '✓ Pay on delivery',
      ck_trust_rating:      '★ 4.9 · +300 customers',
      ck_form_title:         'Your details',
      ck_field_name:          'Full name',
      ck_field_name_ph:       'e.g. John Smith',
      ck_field_phone:         'Phone (WhatsApp)',
      ck_field_phone_ph:      'Your personal number',
      ck_field_address:       'Address',
      ck_field_address_ph:    'City, state',
      ck_field_hint:           'We need your personal number to coordinate delivery over WhatsApp.',
      ck_field_err:            'Please fill in all fields to continue.',
      ck_promo_ph:              'Discount code',
      ck_promo_apply:           'Apply',
      ck_promo_clear:           '✕ Remove code',
      ck_info_box:  'Reserve it with <strong>30%</strong> and pay the rest <strong>on delivery</strong>. We\'ll contact you on WhatsApp to coordinate delivery.',
      ck_subtotal:  'Subtotal',
      ck_discount:   'Discount',
      ck_shipping:   'Priority shipping',
      ck_total:       'Total',
      ck_deposit_label: 'Due today (30%)',
      ck_cta:            'Confirm my order',
      ck_cta_sub:        'No payment now · we coordinate over WhatsApp',
      ck_back:            'Back',
      ck_pay_title:       'Choose payment method',
      ck_method_label:    'Select a method',
      ck_method_card:      'Card',
      ck_method_transfer:  'Bank transfer',
      ck_method_cod:        'On delivery',
      ck_cardlink_note:    'You\'ll receive a secure payment link over WhatsApp to complete your purchase with debit/credit card.',
      ck_cardlink_btn:      'Request payment link',
      ck_whatsapp_btn:      'Confirm via WhatsApp',
      ck_cod_note:  'Only available <strong>in Santiago</strong>. An agent will coordinate delivery and payment.',
      ck_cod_btn:            'Confirm pay on delivery',
      ck_pay_secure_label:  'Secure payment with',
      ck_done_title:         'Order confirmed!',
      ck_done_sub:            'We\'ll contact you on WhatsApp to coordinate delivery.',
      ck_done_order:          'Order',
      ck_done_method:         'Method',
      ck_done_delivery:       'Delivery',
      ck_done_delivery_val:   'Coordinated via WhatsApp',
      ck_done_total:          'Total',
      ck_done_track:          'Track your order →',
      ck_done_continue:       'Keep shopping',

      auth_welcome:      'Welcome back',
      auth_google:        'Continue with Google',
      auth_or:             'or',
      auth_tab_login:      'Sign in',
      auth_tab_register:   'Create account',
      auth_email:           'Email',
      auth_email_ph:        'you@email.com',
      auth_password:        'Password',
      auth_password_ph:     '••••••••',
      auth_forgot:           'Forgot your password?',
      auth_login_submit:     'Sign in',
      auth_no_account:       'Don\'t have an account?',
      auth_create_free:      'Create free account',
      auth_back:              '← Back',
      auth_recover_title:     'Recover password',
      auth_recover_sub:       'Enter your email and we\'ll send you a link to create a new password.',
      auth_your_email:        'Your email',
      auth_send_link:          'Send link',
      auth_full_name:          'Full name',
      auth_full_name_ph:       'Your name',
      auth_min_chars_ph:       'At least 6 characters',
      auth_min_chars_hint:     'At least 6 characters',
      auth_register_submit:    'Create account',
      auth_have_account:       'Already have an account?',
      auth_logout:              'Sign out',

      size_pick_title: 'Choose size',
      size_pick_sub:    'Tap a size to add it to your cart.',

      terms_modal_title: 'Terms and conditions',

      trust_modal_eyebrow: 'Calziani',
      trust_modal_title:    '300+ happy customers',
      trust_modal_tagline:  'Pioneers in accessible, exclusive luxury in the DR',
      trust_modal_gallery:  'Real testimonials',
      trust_modal_loading:  'Loading testimonials...',

      trk_label:        'TRACK YOUR ORDER',
      trk_placeholder:   'e.g. CLZ-A1B2C3',
      trk_btn:            'Track',
      trk_detail_link:    'View details →',

      pp_back:               '← Back',
      pp_description:         'Description',
      pp_reviews_title:       'Customer reviews',
      pp_write_review:        'Write a review',
      pp_related_title:       'You might also like',
      pp_add_to_cart:          'Add to cart',
      pp_added:                 'Added! ✓',
      pp_buy_now:                'Buy now',
      pp_out_of_stock:            'Out of stock',
      pp_available:                'Available',
      pp_low_stock:                'Few units left',
      pp_out_of_stock_size:        'Out of stock in this size',
      pp_add_favorite:              'Add to favorites',
      pp_in_favorite:                'In favorites',
      pp_update_label:                'UPDATE:',
      pp_update_text1:                'We\'re going viral on social media and have very few units left.',
      pp_update_text2:                'Get yours now before they sell out!',
      returns_title:      'Returns policy',
      review_title:          'Leave your review',
      review_text_label:      'Your review',
      review_text_ph:           'Tell us what you thought of the product...',
      review_name_label:        'Name',
      review_photo_label:       'Photo of your purchase',
      review_optional:          '(optional)',
      review_choose_photo:      'Choose photo',
      review_hint:               'JPG, PNG or WEBP · max. 8 MB',
      review_submit:             'Post review',
      review_err_format:  'Invalid format. Use JPG, PNG, or WEBP.',
      review_err_size:     'The image can\'t be larger than 8 MB.',
      review_err_rating:    'Select a rating.',
      review_err_length:     'Your review must be at least 10 characters.',
      review_err_name:        'Enter your name.',
      review_err_generic:      'Couldn\'t publish the review.',
      review_plural:             'reviews',
      review_singular:            'review',
      review_be_first:             'Be the first to',
      review_be_first_link:         'leave a review',
      review_default_customer:      'Customer',
      review_photo_alt:             'Purchase photo from',

      breadcrumb_home:       'Home',
      pp_size_select_err:     'Select a size to continue.',
      pp_shipping_prefix:      'Shipping:',
      pp_returns_title:         'Easy returns',
      pp_returns_text:          'If there\'s any issue with your order, we\'ll help you resolve it easily.',
      pp_returns_link:           'View returns policy',
      pp_trust_authentic:        '100% authenticity guaranteed',
      pp_trust_shipping:          'Worldwide shipping available',
      pp_trust_support:            '24/7 personalized support',
      pp_not_found:                 'Product not found.',
      pp_back_to_store:              '← Back to store',
      pp_offer_ending_soon:          '🕐 Special price ends soon',
      pp_offer_ends_in:               '🕐 Special price ends in',
      pp_urgency_prefix:               'Only',
      pp_urgency_suffix:                'left in size',
      pp_color_label:                  'Color',
      pp_additional_info:              'Additional information',
      pp_size_guide_title:             'Size guide',
      pp_size_guide_text:              'We recommend choosing your usual size. If you\'re between two sizes, choose the larger one.',
      pp_shipping_info_title:          'Shipping & delivery',
      pp_shipping_info_text:           'Worldwide shipping. We coordinate final delivery over WhatsApp and you can track your order in real time from "Track order".',

      out_of_stock:      'Out of stock',
      stock_low_hint:     'Few units left',
      available:           'Available',
      add_to_cart:          'Add',
      terms_checkbox:       'I accept Calziani\'s terms and conditions.',
      terms_read:            'Read full terms',
      terms_err:              'You must accept the terms to continue.',
      promo_label:              'Discount code',
      promo_apply:               'Apply',
      promo_remove:               'Remove code',
      promo_discount_label:       'Discount (−20%)',

      // Coupon popup
      cpn_badge:   'LIMITED CODE',
      cpn_valid:    'VALID FOR A LIMITED TIME',
      cpn_week:      'This week only · limited quantity',
      cpn_ends_in:    'Ends in!',
      cpn_days:        'Days',
      cpn_hours:        'Hrs',
      cpn_mins:          'Min',
      cpn_secs:           'Sec',
      cpn_copy:            'COPY',
      cpn_trust:            'Cash on delivery in Santiago · Authentic',
      cpn_fine:              '*Not combinable with other promotions. Valid on all products.',
    },
  };

  function detectLang() {
    const stored = localStorage.getItem('calziani_lang');
    if (stored === 'es' || stored === 'en') return stored;
    // Calziani ships from the Dominican Republic — default to Spanish for the
    // first paint, then refineLangFromGeo() switches to English for visitors
    // whose IP resolves outside the DR.
    return 'es';
  }

  let activeLang = detectLang();

  // Only runs when there's no stored/explicit choice yet. Uses the visitor's
  // IP (via /api/geo) rather than browser language, which foreign travelers
  // or DR expats often leave in English/Spanish regardless of where they are.
  async function refineLangFromGeo() {
    if (localStorage.getItem('calziani_lang')) return;
    let country = null;
    try {
      const res = await fetch('/api/geo');
      const data = await res.json();
      country = data.country || null;
    } catch { /* network hiccup — keep the Spanish default */ }
    const resolved = country && country !== 'DO' ? 'en' : 'es';
    localStorage.setItem('calziani_lang', resolved);
    if (resolved !== activeLang) {
      activeLang = resolved;
      applyTranslations();
      document.dispatchEvent(new CustomEvent('calziani:langchange', { detail: { lang: activeLang } }));
    }
  }

  function t(key) {
    if (T[activeLang] && Object.prototype.hasOwnProperty.call(T[activeLang], key)) return T[activeLang][key];
    if (Object.prototype.hasOwnProperty.call(T.es, key)) return T.es[key];
    return key;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.documentElement.lang = activeLang;
    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = activeLang.toUpperCase();
  }

  function setLang(lang) {
    activeLang = lang === 'en' ? 'en' : 'es';
    localStorage.setItem('calziani_lang', activeLang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('calziani:langchange', { detail: { lang: activeLang } }));
  }

  function initLangBtn() {
    const btn = document.getElementById('langBtn');
    if (!btn) return;
    btn.addEventListener('click', () => setLang(activeLang === 'es' ? 'en' : 'es'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    initLangBtn();
    refineLangFromGeo();
  });

  return {
    t,
    get lang() { return activeLang; },
    setLang,
    applyTranslations,
  };
})();
