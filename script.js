(() => {
	'use strict';

	const storage = {
		get(key, fallback) {
			try {
				return JSON.parse(localStorage.getItem(key)) ?? fallback;
			} catch {
				return fallback;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {
				// Browsers can disable storage; the UI still works for this session.
			}
		}
	};

	const cart = storage.get('joni-cart', {});
	const wishlist = storage.get('joni-wishlist', []);
	const catalog = {
		'Anti Sera ABO Blood Grouping Reagents': ['images/Anti Sera ABO Blood grouping reagents.jfif', 27, 30],
		'Urine Dipstick': ['images/urine dipstick.jfif', 13.5, 15],
		'5 Part Hematology Analyzer': ['images/5 part hematology analyzer.jfif', 36818.2, 38756],
		'Centrifuge': ['images/centrifuge.jfif', 3218.4, 3576],
		'Bacteria Culture Media': ['images/Bacteria culture media.jfif', 1080, 1200],
		'Clinical Chemistry Analyzer': ['images/Clinical chemistry analyzer.jfif', 43638.25, 45935],
		'GeneXpert PCR': ['images/geneXpert PCR.jfif', 34519.2, 36336],
		'CPDA Blood Transfusion Bag': ['images/CPDA Blood transfusion bag.jfif', 384.3, 427],
		'HB Electrophoresis Device': ['images/HB electrophoresis device.jfif', 2455.2, 2728],
		'HIV OraQuick': ['images/HIV Oraquick.jfif', 51.3, 57],
		'Disposable Nose Masks': ['images/Disposable nose masks.jfif', 40.5, 45],
		'EDTA Blood Collection Tube': ['images/EDTA blood collection tube.jfif', 57.6, 64],
		'Hepatitis B Profile Kit': ['images/Hepatitis B profile kit.jfif', 30.6, 34],
		'Semi-Automated Hematology Analyzer': ['images/Semi-atomatated hematology analyzer.jfif', 9088.65, 9567],
		'Semi-Automated Chemistry Analyzer': ['images/Semi-automated chemistry analyzer.jfif', 8537.65, 8987],
		'Zeiss Promorstar Light Microscope': ['images/Zeiss Promorstar light microscope.jfif', 8346.7, 8786],
		'Giemsa Solution': ['images/giemsa solution.jfif', 43.2, 48],
		'MicroPipette': ['images/microPipette.jfif', 23.4, 26],
		'Malaria RDT': ['images/malaria RDT.jfif', 19.8, 22],
		'Latex Examination Gloves': ['images/latex examination gloves.jfif', 40.5, 45],
		'White Laboratory Coat': ['images/White Laboratory coat.jfif', 74.7, 83],
		'Syringe and Needle': ['images/syringe and needle.jfif', 31.5, 35],
		'Serum Gel Separator Tubes': ['images/Serum gel separator tubes.jfif', 46.8, 52]
	};
	const savedProducts = storage.get('joni-products', []);
	const defaultSettings = { businessName: 'Joni Medtech Supply', phone: '+233 24 969 8992', email: 'onipayedejohn11@gmail.com', location: 'Obuasi, Ashanti Region, Ghana', announcement: '' };
	const productCatalog = Object.fromEntries(Object.entries(catalog).map(([name, [image, price, originalPrice]]) => [name, { name, image, price, originalPrice: originalPrice || price, discountPercent: 0, description: '', stock: 10 }]));
	savedProducts.forEach((product) => { if (product.name) productCatalog[product.name] = { ...productCatalog[product.name], ...product }; });
	const formatMoney = (amount) => `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const discountPercent = (product) => { const original = Number(product.originalPrice || product.price); const sale = Number(product.price); return Number(product.discountPercent) > 0 ? Number(product.discountPercent) : original > sale ? ((original - sale) / original) * 100 : 0; };
	const supabaseClient = window.supabaseClient;
	let productCards = [];
	const toast = document.createElement('div');
	toast.className = 'site-toast';
	toast.setAttribute('role', 'status');
	toast.setAttribute('aria-live', 'polite');
	document.body.append(toast);

	const showToast = (message) => {
		toast.textContent = message;
		toast.classList.add('visible');
		clearTimeout(showToast.timer);
		showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
	};

	const setupTheme = () => {
		const savedTheme = storage.get('joni-theme', 'light');
		const applyTheme = (theme) => {
			document.documentElement.dataset.theme = theme;
			document.querySelectorAll('.theme-toggle').forEach((button) => {
				const dark = theme === 'dark';
				button.querySelector('.theme-icon').innerHTML = dark
					? '<svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"></path></svg>'
					: '<svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"></path></svg>';
				button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
				button.setAttribute('aria-pressed', String(dark));
			});
		};
		applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
		document.addEventListener('click', (event) => {
			const button = event.target.closest('.theme-toggle');
			if (!button) return;
			const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
			storage.set('joni-theme', theme);
			applyTheme(theme);
		});
	};

	const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));

	const productName = (card) => card.dataset.productName || card.querySelector('h2')?.textContent.trim();
	const cartQuantity = () => Object.values(cart).reduce((total, quantity) => total + quantity, 0);

	const updateBadges = () => {
		document.querySelectorAll('.cart-count').forEach((badge) => {
			badge.textContent = cartQuantity();
			badge.hidden = cartQuantity() === 0;
		});
		document.querySelectorAll('.wishlist-count').forEach((badge) => {
			badge.textContent = wishlist.length;
			badge.hidden = wishlist.length === 0;
		});
	};

	const authRedirect = () => `auth.html?next=${encodeURIComponent(`${location.pathname.split('/').pop() || 'index.html'}${location.hash}`)}`;

	const getAuthenticatedSession = async () => {
		if (!supabaseClient) return null;
		const { data, error } = await supabaseClient.auth.getSession();
		return error ? null : data.session;
	};

	const requireAuthentication = async () => {
		const session = await getAuthenticatedSession();
		if (session) return session;
		location.assign(authRedirect());
		return null;
	};

	const userIcon = '<svg class="nav-link-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"></path></svg>';
	const shieldIcon = '<svg class="nav-link-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"></path><path d="M9 12l2 2 4-4"></path></svg>';

	const setupAuthNavigation = async () => {
		const navigation = document.querySelector('.header-actions');
		if (!navigation) return;
		const existingLink = navigation.querySelector('.auth-nav-link');
		if (!existingLink) {
			const link = document.createElement('a');
			link.className = 'auth-nav-link';
			link.href = 'auth.html';
			link.innerHTML = `${userIcon}<span>Login</span>`;
			navigation.append(link);
		}
		const session = await getAuthenticatedSession();
		const authLinks = [...document.querySelectorAll('.auth-nav-link')];
		authLinks.forEach((link) => {
			if (!link.querySelector('span')) link.innerHTML = `${userIcon}<span>${link.textContent.trim()}</span>`;
			link.querySelector('span').textContent = session ? 'Account' : 'Login';
			link.href = session ? 'account.html' : 'auth.html';
		});
		if (session) {
			const { data: profile } = await supabaseClient.from('profiles').select('role, is_active').eq('id', session.user.id).maybeSingle();
			if (profile?.is_active === true && profile.role === 'admin') {
				authLinks.forEach((link) => {
					const container = link.closest('.header-actions, .nav-drawer-account');
					if (!container || container.querySelector('.admin-nav-link')) return;
					const adminLink = document.createElement('a');
					adminLink.href = 'admin.html';
					adminLink.className = 'admin-nav-link';
					adminLink.innerHTML = `${shieldIcon}<span>Admin</span>`;
					container.prepend(adminLink);
				});
			}
		}
	};

	const setupNavigation = () => {
		const currentPage = location.pathname.split('/').pop() || 'index.html';
		document.querySelectorAll('.main-nav a').forEach((link) => {
			const page = link.getAttribute('href')?.split('#')[0] || '';
			link.classList.toggle('active', page === currentPage || (!page && currentPage === 'index.html'));
		});
	};

	const setupStoreCatalog = () => {
		const productList = document.querySelector('#productList');
		if (!productList) return;
		const existingNames = new Set();
		productList.querySelectorAll('.product-item').forEach((card) => {
			const name = card.dataset.productName;
			if (!name || !productCatalog[name]) return;
			existingNames.add(name);
			const product = productCatalog[name];
			card.querySelector('img').src = product.image;
			card.querySelector('img').alt = product.name;
			card.querySelector('h2').textContent = product.name;
			card.querySelector('.product-description').textContent = product.description || card.querySelector('.product-description').textContent.trim();
			card.querySelector('.discount-price').textContent = formatMoney(Number(product.price));
			const original = Number(product.originalPrice || product.price);
			const percent = discountPercent(product);
			card.querySelector('.original-price').textContent = original > Number(product.price) ? formatMoney(original) : '';
			card.querySelector('.original-price').hidden = original <= Number(product.price);
			card.querySelector('.discount-badge').textContent = percent > 0 ? `↓ ${Math.round(percent)}%` : '';
			card.querySelector('.discount-badge').hidden = percent <= 0;
			card.querySelector('.stock-text').textContent = `${Number(product.stock) || 0} items left`;
			card.querySelector('.stock-bar').style.width = `${Math.min(100, Math.max(5, Number(product.stock) * 3))}%`;
		});
		Object.values(productCatalog).filter((product) => !existingNames.has(product.name)).forEach((product) => {
			const card = document.createElement('article');
			card.className = 'product-item';
			card.dataset.productName = product.name;
			const original = Number(product.originalPrice || product.price);
			const percent = discountPercent(product);
			card.innerHTML = `<div class="product-image-wrapper"><img src="${product.image}" alt="${product.name}"><span class="discount-badge"${percent > 0 ? '' : ' hidden'}>↓ ${Math.round(percent)}%</span><button class="wishlist-button" type="button" aria-label="Add ${product.name} to wishlist">♡</button></div><h2>${product.name}</h2><p class="product-description">${product.description || 'Medical laboratory product supplied by Joni Medtech Supply.'}</p><div class="product-price"><span class="discount-price">${formatMoney(Number(product.price))}</span><span class="original-price"${original > Number(product.price) ? '' : ' hidden'}>${formatMoney(original)}</span></div><div class="stock-info"><span class="stock-text">${Number(product.stock) || 0} items left</span><div class="stock-progress"><span class="stock-bar stock-high" style="width: ${Math.min(100, Math.max(5, Number(product.stock) * 3))}%;"></span></div></div><button class="add-cart-button" type="button">Add to Cart</button>`;
			productList.append(card);
		});
		productCards = [...productList.querySelectorAll('.product-item')];
	};

	const syncSupabaseProducts = async () => {
		if (!supabaseClient || sessionStorage.getItem('joni-supabase-products-synced')) return;
		const { data, error } = await supabaseClient.from('products').select('name, description, image_path, price, original_price, discount_percent, stock').eq('is_active', true);
		if (error) {
			console.warn('Supabase product sync failed; local catalogue remains active.', error.message);
			return;
		}
		if (data?.length) {
			storage.set('joni-products', data.map((product) => ({ name: product.name, description: product.description, image: product.image_path, price: Number(product.price), originalPrice: Number(product.original_price || product.price), discountPercent: Number(product.discount_percent || 0), stock: Number(product.stock) })));
		}
		sessionStorage.setItem('joni-supabase-products-synced', 'true');
		if (data?.length) location.reload();
	};

	const setupCarousel = () => {
		const carousel = document.querySelector('.hero-carousel');
		if (!carousel) return;
		const slides = [...carousel.querySelectorAll('.hero-slide')];
		const dots = [...carousel.querySelectorAll('.carousel-dot')];
		let current = slides.findIndex((slide) => slide.classList.contains('active-slide'));
		let timer;

		const showSlide = (index) => {
			current = (index + slides.length) % slides.length;
			slides.forEach((slide, position) => slide.classList.toggle('active-slide', position === current));
			dots.forEach((dot, position) => {
				dot.classList.toggle('active-dot', position === current);
				dot.setAttribute('aria-current', position === current ? 'true' : 'false');
			});
		};
		const restart = () => {
			clearInterval(timer);
			timer = setInterval(() => showSlide(current + 1), 6500);
		};
		carousel.querySelector('.carousel-prev')?.addEventListener('click', () => { showSlide(current - 1); restart(); });
		carousel.querySelector('.carousel-next')?.addEventListener('click', () => { showSlide(current + 1); restart(); });
		dots.forEach((dot, index) => dot.addEventListener('click', () => { showSlide(index); restart(); }));
		showSlide(current < 0 ? 0 : current);
		restart();
	};

	const setupSearch = () => {
		const input = document.querySelector('#productSearch');
		if (!input || !productCards.length) return;
		const filter = () => {
			const query = input.value.trim().toLowerCase();
			let visible = 0;
			productCards.forEach((card) => {
				const matches = productName(card).toLowerCase().includes(query);
				card.hidden = !matches;
				if (matches) visible += 1;
			});
			let empty = document.querySelector('.empty-products');
			if (!visible) {
				empty ??= Object.assign(document.createElement('p'), { className: 'empty-products' });
				empty.textContent = 'No products match your search. Try another term.';
				document.querySelector('#productList').append(empty);
			} else {
				empty?.remove();
			}
		};
		input.addEventListener('input', filter);
		document.querySelector('#searchButton')?.addEventListener('click', () => { input.focus(); filter(); });
	};

	const setupWishlist = () => {
		document.querySelectorAll('.wishlist-button').forEach((button) => {
			const card = button.closest('.product-item');
			const name = productName(card);
			const refresh = () => {
				const active = wishlist.includes(name);
				button.classList.toggle('active', active);
				button.textContent = active ? '♥' : '♡';
				button.setAttribute('aria-label', `${active ? 'Remove' : 'Add'} ${name} ${active ? 'from' : 'to'} wishlist`);
			};
			button.addEventListener('click', () => {
				const index = wishlist.indexOf(name);
				index >= 0 ? wishlist.splice(index, 1) : wishlist.push(name);
				storage.set('joni-wishlist', wishlist);
				refresh();
				updateBadges();
				showToast(index >= 0 ? 'Removed from wishlist' : 'Added to wishlist');
			});
			refresh();
		});
	};

	const setupCart = () => {
		document.querySelectorAll('.add-cart-button').forEach((button) => button.addEventListener('click', async () => {
			if (!await requireAuthentication()) return;
			const name = productName(button.closest('.product-item'));
			cart[name] = (cart[name] || 0) + 1;
			storage.set('joni-cart', cart);
			updateBadges();
			showToast(`${name} added to cart`);
		}));
	};

	const cartSubtotal = () => Object.entries(cart).reduce((total, [name, quantity]) => total + (productCatalog[name]?.price || 0) * quantity, 0);

	const createModalShell = (variantClass) => {
		const overlay = document.createElement('div');
		overlay.className = `review-modal-overlay ${variantClass}-overlay`;
		overlay.hidden = true;
		overlay.innerHTML = `<div class="review-modal ${variantClass}" role="dialog" aria-modal="true"><button type="button" class="review-modal-close" aria-label="Close">×</button><div class="${variantClass}-body"></div></div>`;
		document.body.append(overlay);
		const close = () => { overlay.hidden = true; };
		overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
		overlay.querySelector('.review-modal-close').addEventListener('click', close);
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) close(); });
		return { overlay, body: overlay.querySelector(`.${variantClass}-body`), close };
	};

	let wishlistModalRefs = null;
	const getWishlistModal = () => wishlistModalRefs ??= createModalShell('wishlist-modal');

	const renderWishlistModal = () => {
		const refs = getWishlistModal();
		refs.overlay.hidden = false;
		const items = wishlist.filter((name) => productCatalog[name]);
		if (!items.length) {
			refs.body.innerHTML = '<h2>Your Wishlist</h2><div class="commerce-empty"><strong>Your wishlist is waiting for products.</strong><p>Save products from the shop and they will appear here.</p><a class="primary-action" href="shop.html">Explore the shop</a></div>';
			return;
		}
		refs.body.innerHTML = `<h2>Your Wishlist</h2><div class="wishlist-modal-grid">${items.map((name) => { const { image, price } = productCatalog[name]; return `<article class="wishlist-card"><img src="${image}" alt="${escapeHtml(name)}"><div class="wishlist-card-body"><h3>${escapeHtml(name)}</h3><strong>${formatMoney(price)}</strong><div class="wishlist-card-actions"><button type="button" class="primary-action wishlist-modal-add" data-name="${escapeHtml(name)}">Add to cart</button><button type="button" class="text-action wishlist-modal-remove" data-name="${escapeHtml(name)}">Remove</button></div></div></article>`; }).join('')}</div>`;
		refs.body.querySelectorAll('.wishlist-modal-add').forEach((button) => button.addEventListener('click', () => { const name = button.dataset.name; cart[name] = (cart[name] || 0) + 1; storage.set('joni-cart', cart); updateBadges(); showToast(`${name} added to cart`); }));
		refs.body.querySelectorAll('.wishlist-modal-remove').forEach((button) => button.addEventListener('click', () => { const name = button.dataset.name; wishlist.splice(wishlist.indexOf(name), 1); storage.set('joni-wishlist', wishlist); updateBadges(); renderWishlistModal(); }));
	};

	const openWishlistModal = () => renderWishlistModal();

	let cartModalRefs = null;
	const getCartModal = () => cartModalRefs ??= createModalShell('cart-modal');

	const renderCartModalCart = (refs) => {
		const names = Object.keys(cart).filter((name) => productCatalog[name] && cart[name] > 0);
		if (!names.length) {
			refs.body.innerHTML = '<h2>Your Cart</h2><div class="commerce-empty"><strong>Your cart is empty.</strong><p>Add products from the shop to begin your order.</p><a class="primary-action" href="shop.html">Continue shopping</a></div>';
			return;
		}
		const rows = names.map((name) => { const { image, price } = productCatalog[name]; return `<article class="cart-page-row"><img src="${image}" alt="${escapeHtml(name)}"><div class="cart-page-product"><h2>${escapeHtml(name)}</h2><span>${formatMoney(price)} each</span><button type="button" class="text-action cart-modal-remove" data-name="${escapeHtml(name)}">Remove</button></div><div class="quantity-control"><button type="button" aria-label="Decrease ${escapeHtml(name)} quantity" class="quantity-decrease" data-name="${escapeHtml(name)}">−</button><output>${cart[name]}</output><button type="button" aria-label="Increase ${escapeHtml(name)} quantity" class="quantity-increase" data-name="${escapeHtml(name)}">+</button></div><strong class="cart-line-total">${formatMoney(price * cart[name])}</strong></article>`; }).join('');
		const subtotal = cartSubtotal();
		refs.body.innerHTML = `<h2>Your Cart</h2><div class="cart-modal-items">${rows}</div><div class="order-summary"><h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></div><div class="summary-line"><span>Delivery</span><span>Confirmed after enquiry</span></div><div class="summary-total"><span>Total before delivery</span><strong>${formatMoney(subtotal)}</strong></div><button type="button" class="primary-action cart-modal-checkout">Continue to checkout</button><p class="summary-note">Your order is confirmed by our team before payment or delivery.</p></div>`;
		refs.body.querySelectorAll('.quantity-decrease').forEach((button) => button.addEventListener('click', () => { const name = button.dataset.name; cart[name] -= 1; if (cart[name] <= 0) delete cart[name]; storage.set('joni-cart', cart); updateBadges(); renderCartModalCart(refs); }));
		refs.body.querySelectorAll('.quantity-increase').forEach((button) => button.addEventListener('click', () => { const name = button.dataset.name; cart[name] += 1; storage.set('joni-cart', cart); updateBadges(); renderCartModalCart(refs); }));
		refs.body.querySelectorAll('.cart-modal-remove').forEach((button) => button.addEventListener('click', () => { delete cart[button.dataset.name]; storage.set('joni-cart', cart); updateBadges(); renderCartModalCart(refs); }));
		refs.body.querySelector('.cart-modal-checkout')?.addEventListener('click', async () => { if (!await requireAuthentication()) return; renderCartModalCheckout(refs); });
	};

	const renderCartModalCheckout = (refs) => {
		refs.body.innerHTML = `<h2>Secure Checkout</h2><p class="checkout-lede">We will use these details to confirm availability and arrange delivery.</p><form class="checkout-form" id="cartModalCheckoutForm"><div class="checkout-fields"><label>Full name<input name="name" autocomplete="name" required></label><label>Email address<input type="email" name="email" autocomplete="email" required></label><label>Phone number<input type="tel" name="phone" autocomplete="tel" required></label><label>Delivery location<input name="location" autocomplete="street-address" required></label></div><label>Order notes <textarea name="notes" rows="3" placeholder="Optional delivery or product notes"></textarea></label><div class="checkout-actions"><button class="primary-action" type="submit">Place order</button><button class="text-action" type="button" id="cartModalBack">Back to cart</button></div></form>`;
		refs.body.querySelector('#cartModalBack').addEventListener('click', () => renderCartModalCart(refs));
		refs.body.querySelector('#cartModalCheckoutForm').addEventListener('submit', async (event) => {
			event.preventDefault();
			if (!Object.keys(cart).length) return;
			const submitButton = event.currentTarget.querySelector('button[type="submit"]');
			submitButton.disabled = true;
			const data = new FormData(event.currentTarget);
			const orderNumber = `JONI-${Date.now().toString().slice(-6)}`;
			const order = { orderNumber, name: data.get('name'), email: data.get('email'), phone: data.get('phone'), location: data.get('location'), notes: data.get('notes'), total: cartSubtotal(), items: Object.entries(cart).map(([name, quantity]) => ({ name, quantity, price: productCatalog[name]?.price || 0 })), createdAt: new Date().toISOString() };
			if (supabaseClient) {
				const { data: remoteProducts } = await supabaseClient.from('products').select('id, name').in('name', Object.keys(cart));
				if (remoteProducts?.length === Object.keys(cart).length) {
					const remoteItems = Object.entries(cart).map(([name, quantity]) => ({ product_id: remoteProducts.find((product) => product.name === name).id, quantity }));
					const { data: remoteOrder, error } = await supabaseClient.rpc('create_order', { p_customer_name: order.name, p_customer_email: order.email, p_customer_phone: order.phone, p_delivery_location: order.location, p_notes: order.notes, p_items: remoteItems });
					if (error) { submitButton.disabled = false; showToast('We could not submit the order. Please try again.'); return; }
					if (remoteOrder?.order_number) order.orderNumber = remoteOrder.order_number;
				}
			}
			const orderHistory = storage.get('joni-orders', []);
			orderHistory.push(order);
			storage.set('joni-orders', orderHistory);
			storage.set('joni-last-order', order);
			Object.keys(cart).forEach((name) => delete cart[name]);
			storage.set('joni-cart', cart);
			updateBadges();
			refs.body.innerHTML = `<div class="order-confirmation"><span class="section-label">ORDER RECEIVED</span><h2>Thank you, ${escapeHtml(data.get('name'))}.</h2><p>Your enquiry <strong>${escapeHtml(order.orderNumber)}</strong> has been received. We will contact you at ${escapeHtml(data.get('phone'))} to confirm availability, delivery, and payment.</p><div class="checkout-actions"><a class="primary-action" href="shop.html">Return to shop</a><button type="button" class="text-action" id="cartModalContinue">Continue browsing</button></div></div>`;
			refs.body.querySelector('#cartModalContinue').addEventListener('click', refs.close);
		});
	};

	const openCartModal = () => {
		const refs = getCartModal();
		refs.overlay.hidden = false;
		renderCartModalCart(refs);
	};

	let trackModalRefs = null;
	const getTrackModal = () => trackModalRefs ??= createModalShell('track-modal');

	const renderTrackResult = (order) => {
		const status = String(order.status || 'pending').toLowerCase();
		const steps = ['pending', 'confirmed', 'processing', 'completed'];
		const current = steps.indexOf(status);
		return `<div class="status-result-heading"><div><span class="status-eyebrow">${escapeHtml(order.order_number)}</span><h2>Order status</h2><p>Placed ${new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><span class="order-status status-${escapeHtml(status)}">${escapeHtml(status)}</span></div><div class="status-timeline">${steps.map((step, index) => `<div class="status-step ${index <= current ? 'complete' : ''} ${index === current ? 'current' : ''}"><span>${index < current ? '✓' : index + 1}</span><strong>${step}</strong></div>`).join('')}</div><div class="status-order-summary"><div><span>Order total</span><strong>${formatMoney(order.total)}</strong></div><div><span>Delivery location</span><strong>${escapeHtml(order.delivery_location || 'Being confirmed')}</strong></div></div><div class="status-items">${(order.order_items || []).map((item) => `<div><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${formatMoney(item.line_total)}</strong></div>`).join('') || '<p>Item details are unavailable for this order.</p>'}</div>`;
	};

	const openTrackModal = async () => {
		const refs = getTrackModal();
		refs.overlay.hidden = false;
		if (!supabaseClient) { refs.body.innerHTML = '<h2>Track your order</h2><p class="review-empty">Order tracking is temporarily unavailable.</p>'; return; }
		refs.body.innerHTML = '<h2>Track your order</h2><p class="track-modal-loading">Checking sign-in status...</p>';
		const session = await getAuthenticatedSession();
		refs.body.innerHTML = `<h2>Track your order</h2>${session ? '' : `<p class="review-signin-note">Please <a href="${authRedirect()}">sign in</a> to securely check an order connected to your account.</p>`}<form class="status-form" id="trackModalForm"><label>Order number<input name="orderNumber" placeholder="e.g. JONI-AB12CD34" autocomplete="off" required></label><label>Order email<input name="email" type="email" placeholder="The email used at checkout" autocomplete="email" required></label><button class="primary-action" type="submit"${session ? '' : ' disabled'}>Check order status</button></form><div class="track-modal-message" id="trackModalMessage" hidden></div><div class="status-result" id="trackModalResult" hidden></div>`;
		const form = refs.body.querySelector('#trackModalForm');
		const messageBox = refs.body.querySelector('#trackModalMessage');
		const resultBox = refs.body.querySelector('#trackModalResult');
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			messageBox.hidden = true;
			resultBox.hidden = true;
			const submitButton = form.querySelector('button');
			submitButton.disabled = true;
			submitButton.textContent = 'Checking...';
			const values = Object.fromEntries(new FormData(form));
			const { data, error } = await supabaseClient.rpc('lookup_order_status', { p_order_number: values.orderNumber.trim().toUpperCase(), p_customer_email: values.email.trim().toLowerCase() });
			submitButton.disabled = false;
			submitButton.textContent = 'Check order status';
			if (error || !data?.length) { messageBox.hidden = false; messageBox.textContent = 'We could not find an order matching those details.'; return; }
			resultBox.hidden = false;
			resultBox.innerHTML = renderTrackResult(data[0]);
		});
	};

	const setupPopupTriggers = () => {
		document.querySelectorAll('[data-open="wishlist"]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); openWishlistModal(); }));
		document.querySelectorAll('[data-open="cart"]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); openCartModal(); }));
		document.querySelectorAll('[data-open="track"]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); openTrackModal(); }));
	};

	const setupNavToggle = () => {
		const toggle = document.querySelector('#navToggle');
		const nav = document.querySelector('#mainNav');
		const scrim = document.querySelector('#navScrim');
		if (!toggle || !nav) return;
		const setOpen = (open) => {
			nav.classList.toggle('open', open);
			toggle.classList.toggle('open', open);
			toggle.setAttribute('aria-expanded', String(open));
			if (scrim) scrim.hidden = !open;
		};
		toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
		scrim?.addEventListener('click', () => setOpen(false));
		nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
	};

	const reviewStats = new Map();
	const starGlyphs = (value) => { const filled = Math.max(0, Math.min(5, Math.round(Number(value) || 0))); return '★'.repeat(filled) + '☆'.repeat(5 - filled); };

	let reviewModalRefs = null;
	const buildReviewModal = () => {
		if (reviewModalRefs) return reviewModalRefs;
		const overlay = document.createElement('div');
		overlay.className = 'review-modal-overlay';
		overlay.hidden = true;
		overlay.innerHTML = `<div class="review-modal" role="dialog" aria-modal="true" aria-labelledby="reviewModalTitle"><button type="button" class="review-modal-close" aria-label="Close reviews">×</button><h2 id="reviewModalTitle"></h2><div class="review-summary"><span class="review-summary-stars" aria-hidden="true"></span><span class="review-summary-score"></span><span class="review-summary-count"></span></div><div class="review-form-area"></div><div class="review-list"></div></div>`;
		document.body.append(overlay);
		const close = () => { overlay.hidden = true; };
		overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
		overlay.querySelector('.review-modal-close').addEventListener('click', close);
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) close(); });
		reviewModalRefs = {
			overlay,
			title: overlay.querySelector('#reviewModalTitle'),
			summaryStars: overlay.querySelector('.review-summary-stars'),
			summaryScore: overlay.querySelector('.review-summary-score'),
			summaryCount: overlay.querySelector('.review-summary-count'),
			formArea: overlay.querySelector('.review-form-area'),
			list: overlay.querySelector('.review-list')
		};
		return reviewModalRefs;
	};

	const renderRatingBadge = (card, name) => {
		const badge = card?.querySelector('.product-rating');
		if (!badge) return;
		const stats = reviewStats.get(name);
		if (stats?.count) {
			badge.innerHTML = `<span class="product-rating-stars" aria-hidden="true">${starGlyphs(stats.average)}</span><span class="product-rating-value">${stats.average.toFixed(1)}</span><span class="product-rating-count">(${stats.count})</span>`;
			badge.setAttribute('aria-label', `${stats.average.toFixed(1)} out of 5 stars from ${stats.count} review${stats.count === 1 ? '' : 's'}. Click to read reviews.`);
		} else {
			badge.innerHTML = `<span class="product-rating-stars" aria-hidden="true">☆☆☆☆☆</span><span class="product-rating-count">No reviews yet</span>`;
			badge.setAttribute('aria-label', 'No reviews yet. Click to write the first review.');
		}
	};

	const openReviewModal = async (name) => {
		const refs = buildReviewModal();
		refs.title.textContent = name;
		refs.overlay.hidden = false;
		refs.summaryStars.textContent = '☆☆☆☆☆';
		refs.summaryScore.textContent = '';
		refs.summaryCount.textContent = 'Loading reviews...';
		refs.formArea.innerHTML = '';
		refs.list.innerHTML = '';

		const { data: reviews, error } = await supabaseClient.from('reviews').select('user_id, customer_name, rating, comment, created_at').eq('product_name', name).order('created_at', { ascending: false });
		if (error || !reviews) {
			refs.summaryCount.textContent = '';
			refs.list.innerHTML = '<p class="review-empty">We could not load reviews right now. Please try again later.</p>';
			return;
		}

		const count = reviews.length;
		const average = count ? reviews.reduce((sum, item) => sum + Number(item.rating), 0) / count : 0;
		reviewStats.set(name, { average, count });
		document.querySelectorAll('.product-item').forEach((card) => { if (productName(card) === name) renderRatingBadge(card, name); });

		refs.summaryStars.textContent = starGlyphs(average);
		refs.summaryScore.textContent = count ? average.toFixed(1) : 'No ratings yet';
		refs.summaryCount.textContent = count ? `${count} review${count === 1 ? '' : 's'}` : '';
		refs.list.innerHTML = count
			? reviews.map((review) => `<article class="review-row"><div class="review-row-top"><span class="review-row-name">${escapeHtml(review.customer_name || 'Verified customer')}</span><span class="review-row-stars" aria-hidden="true">${starGlyphs(review.rating)}</span></div><div class="review-row-date">${new Date(review.created_at).toLocaleDateString()}</div>${review.comment ? `<p class="review-row-comment">${escapeHtml(review.comment)}</p>` : ''}</article>`).join('')
			: '<p class="review-empty">No reviews yet. Be the first to review this product.</p>';

		const session = await getAuthenticatedSession();
		if (!session) {
			refs.formArea.innerHTML = `<p class="review-signin-note">Please <a href="${authRedirect()}">sign in</a> to leave a review.</p>`;
			return;
		}

		const mine = reviews.find((review) => review.user_id === session.user.id);
		let selected = mine ? Number(mine.rating) : 0;
		refs.formArea.innerHTML = `<form class="review-form">
			<div class="review-star-input" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((value) => `<button type="button" data-value="${value}" aria-label="${value} star${value === 1 ? '' : 's'}" aria-pressed="false">★</button>`).join('')}</div>
			<textarea name="comment" maxlength="600" placeholder="Share your experience with this product (optional)">${escapeHtml(mine?.comment || '')}</textarea>
			<button type="submit" class="primary-action">${mine ? 'Update review' : 'Submit review'}</button>
		</form>`;

		const form = refs.formArea.querySelector('form');
		const starButtons = [...form.querySelectorAll('.review-star-input button')];
		const paintStars = (value) => starButtons.forEach((button) => { const active = Number(button.dataset.value) <= value; button.classList.toggle('filled', active); button.setAttribute('aria-pressed', String(active)); });
		paintStars(selected);
		starButtons.forEach((button) => {
			button.addEventListener('mouseenter', () => paintStars(Number(button.dataset.value)));
			button.addEventListener('mouseleave', () => paintStars(selected));
			button.addEventListener('click', () => { selected = Number(button.dataset.value); paintStars(selected); });
		});

		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (!selected) { showToast('Please choose a star rating'); return; }
			const submitButton = form.querySelector('button[type="submit"]');
			submitButton.disabled = true;
			const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle();
			const customerName = profile?.full_name || session.user.user_metadata?.full_name || 'Verified customer';
			const comment = form.comment.value.trim();
			const { error: submitError } = await supabaseClient.from('reviews').upsert({ product_name: name, user_id: session.user.id, customer_name: customerName, rating: selected, comment }, { onConflict: 'product_name,user_id' });
			submitButton.disabled = false;
			if (submitError) { showToast('We could not submit your review. Please try again.'); return; }
			showToast(mine ? 'Review updated' : 'Review submitted');
			openReviewModal(name);
		});
	};

	const setupReviews = async () => {
		const productList = document.querySelector('#productList');
		if (!productList || !supabaseClient) return;

		const cards = [...productList.querySelectorAll('.product-item')];
		cards.forEach((card) => {
			const name = productName(card);
			if (!name || card.querySelector('.product-rating')) return;
			const badge = document.createElement('button');
			badge.type = 'button';
			badge.className = 'product-rating';
			badge.innerHTML = '<span class="product-rating-stars" aria-hidden="true">☆☆☆☆☆</span><span class="product-rating-count">No reviews yet</span>';
			badge.addEventListener('click', () => openReviewModal(name));
			card.querySelector('h2')?.insertAdjacentElement('afterend', badge);
		});

		const { data, error } = await supabaseClient.from('reviews').select('product_name, rating');
		if (error || !data) return;
		const grouped = new Map();
		data.forEach((row) => {
			const entry = grouped.get(row.product_name) || { total: 0, count: 0 };
			entry.total += Number(row.rating);
			entry.count += 1;
			grouped.set(row.product_name, entry);
		});
		grouped.forEach((entry, name) => reviewStats.set(name, { average: entry.total / entry.count, count: entry.count }));
		cards.forEach((card) => { const name = productName(card); if (name) renderRatingBadge(card, name); });
	};

	const setupContactForm = () => {
		const form = document.querySelector('.contact-form form');
		if (!form) return;
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const data = new FormData(form);
			const subject = encodeURIComponent(data.get('subject'));
			const body = encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone') || 'Not provided'}\n\n${data.get('message')}`);
			window.location.href = `mailto:onipayedejohn11@gmail.com?subject=${subject}&body=${body}`;
			showToast('Opening your email app...');
		});
	};

	const setupAdmin = async () => {
		if (!document.querySelector('.admin-page')) return;
		document.body.classList.add('admin-auth-pending');
		if (!supabaseClient) { location.assign('auth.html?next=admin.html'); return; }
		const { data: sessionData } = await supabaseClient.auth.getSession();
		if (!sessionData.session) { location.assign('auth.html?next=admin.html'); return; }
		const { data: profile } = await supabaseClient.from('profiles').select('role, is_active').eq('id', sessionData.session.user.id).maybeSingle();
		if (!profile || profile.is_active !== true || profile.role !== 'admin') { location.assign('shop.html'); return; }
		document.body.classList.remove('admin-auth-pending');
		const adminToast = document.querySelector('#adminToast');
		const notify = (message) => { adminToast.textContent = message; adminToast.classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => adminToast.classList.remove('visible'), 2600); };
		let products = storage.get('joni-products', []);
		let orders = storage.get('joni-orders', []);
		let settings = { ...defaultSettings, ...storage.get('joni-settings', {}) };
		const productForm = document.querySelector('#productForm');
		const productList = document.querySelector('#adminProductList');
		const metrics = document.querySelector('#adminMetrics');
		const orderList = document.querySelector('#adminOrderList');
		const renderMetrics = () => { const units = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0); metrics.innerHTML = `<div class="admin-metric"><span>Products</span><strong>${new Set([...Object.keys(catalog), ...products.map((product) => product.name)]).size}</strong><small>Managed catalogue</small></div><div class="admin-metric"><span>Cart units</span><strong>${units}</strong><small>Current browser session</small></div><div class="admin-metric"><span>Orders</span><strong>${orders.length}</strong><small>Saved enquiries</small></div><div class="admin-metric"><span>Wishlist</span><strong>${wishlist.length}</strong><small>Saved products</small></div>`; };
		const analyticsKpis = document.querySelector('#analyticsKpis');
		const chartColors = ['#087e8b', '#90db79', '#f2a65a', '#d95d39', '#756bb1', '#4c956c'];
		const categoryFor = (name) => /analy[sz]er|microscope|centrifuge|pipette|device/i.test(name) ? 'Equipment' : /reagent|solution|media|kit|RDT|dipstick/i.test(name) ? 'Diagnostics' : /glove|mask|coat|syringe|tube|bag/i.test(name) ? 'Consumables' : 'Other';
		const filteredOrders = () => { const days = Number(document.querySelector('#analyticsWindow').value); const cutoff = Date.now() - days * 86400000; return orders.filter((order) => Date.parse(order.createdAt) >= cutoff); };
		const svgShell = (content, label = 'Analytics chart') => `<svg class="analytics-svg" viewBox="0 0 640 280" role="img" aria-label="${label}">${content}</svg>`;
		const chartTip = (element) => { const tip = document.createElement('div'); tip.className = 'chart-tooltip'; document.body.append(tip); element.addEventListener('pointerenter', () => { tip.textContent = element.dataset.tooltip || ''; tip.classList.add('visible'); }); element.addEventListener('pointermove', (event) => { tip.style.left = `${event.clientX + 14}px`; tip.style.top = `${event.clientY + 14}px`; }); element.addEventListener('pointerleave', () => tip.classList.remove('visible')); };
		const mountChart = (id, markup) => { const root = document.querySelector(`#${id}`); root.innerHTML = markup; root.querySelectorAll('[data-tooltip]').forEach(chartTip); };
		const shortName = (name, length = 15) => name.length > length ? `${name.slice(0, length - 1)}…` : name;
		const chartScales = (values) => { const max = Math.max(...values, 1); return { max, y: (value) => 232 - (value / max) * 190 }; };
		const renderLineChart = (sales, profit, labels = []) => { const values = [...sales, ...profit]; const scale = chartScales(values); const width = Math.max(1, sales.length - 1); const points = (series) => series.map((value, index) => `${40 + (index / width) * 570},${scale.y(value)}`).join(' '); const axisLabels = sales.map((_, index) => `<text x="${40 + (index / width) * 570}" y="258" text-anchor="middle">${escapeHtml(labels[index] || String(index + 1))}</text>`).join(''); const empty = values.every((value) => value === 0) ? '<text class="chart-empty-label" x="320" y="150" text-anchor="middle">No orders in this period yet</text>' : ''; mountChart('salesProfitChart', svgShell(`<g class="chart-grid"><path d="M40 42H610M40 137H610M40 232H610"></path></g><polyline class="chart-line sales-line" points="${points(sales)}"></polyline><polyline class="chart-line profit-line" points="${points(profit)}"></polyline>${sales.map((value, index) => `<circle class="chart-point sales-point" cx="${40 + (index / width) * 570}" cy="${scale.y(value)}" r="4" data-tooltip="Sales: ${formatMoney(value)}"></circle><circle class="chart-point profit-point" cx="${40 + (index / width) * 570}" cy="${scale.y(profit[index])}" r="4" data-tooltip="Profit: ${formatMoney(profit[index])}"></circle>`).join('')}<g class="chart-labels">${axisLabels}</g>${empty}`, 'Sales and estimated profit trend')); };
		const renderClusteredBars = (items) => { const scale = chartScales(items.flatMap((item) => [item.sales, item.profit])); const groupWidth = 570 / Math.max(items.length, 1); const bars = items.map((item, index) => { const x = 40 + index * groupWidth; const salesHeight = (item.sales / scale.max) * 190; const profitHeight = (item.profit / scale.max) * 190; return `<rect class="bar sales-bar" x="${x + 5}" y="${232 - salesHeight}" width="${Math.max(8, groupWidth / 3 - 4)}" height="${salesHeight}" data-tooltip="${escapeHtml(item.name)} sales: ${formatMoney(item.sales)}"></rect><rect class="bar profit-bar" x="${x + groupWidth / 3 + 5}" y="${232 - profitHeight}" width="${Math.max(8, groupWidth / 3 - 4)}" height="${profitHeight}" data-tooltip="${escapeHtml(item.name)} profit: ${formatMoney(item.profit)}"></rect><text x="${x + groupWidth / 2}" y="258" text-anchor="middle">${escapeHtml(shortName(item.name, 10))}</text>`; }).join(''); mountChart('productClusterChart', svgShell(`<g class="chart-grid"><path d="M40 42H610M40 137H610M40 232H610"></path></g>${bars}`, 'Clustered product sales and profit')); };
		const renderDonut = (groups) => { const actualTotal = groups.reduce((sum, group) => sum + group.value, 0); const total = actualTotal || 1; let offset = 0; const rings = actualTotal ? groups.map((group, index) => { const dash = (group.value / total) * 100; const result = `<circle class="donut-segment" cx="140" cy="140" r="82" pathLength="100" stroke="${chartColors[index % chartColors.length]}" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${-offset}" data-tooltip="${group.name}: ${formatMoney(group.value)}"></circle>`; offset += dash; return result; }).join('') : ''; const legend = actualTotal ? groups.map((group, index) => `<text x="290" y="${85 + index * 28}"><tspan fill="${chartColors[index % chartColors.length]}">●</tspan> ${escapeHtml(group.name)} ${Math.round((group.value / total) * 100)}%</text>`).join('') : '<text class="chart-empty-label" x="320" y="150" text-anchor="middle">No category sales yet</text>'; mountChart('categoryDonutChart', svgShell(`<g class="donut-chart"><circle class="donut-base" cx="140" cy="140" r="82"></circle>${rings}<text class="donut-total" x="140" y="137" text-anchor="middle">${actualTotal ? formatMoney(actualTotal) : 'No sales'}</text><text class="donut-caption" x="140" y="158" text-anchor="middle">${actualTotal ? 'sales' : 'awaiting orders'}</text>${legend}</g>`, 'Sales by product category')); };
		const renderStacked = (ordersInWindow) => { const status = [{ name: 'Completed', value: ordersInWindow.length }, { name: 'Pending review', value: ordersInWindow.length ? Math.ceil(ordersInWindow.length * 0.15) : 0 }]; const total = Math.max(status.reduce((sum, item) => sum + item.value, 0), 1); let x = 40; const bars = status.map((item, index) => { const width = (item.value / total) * 570; const markup = `<rect class="stack-bar" x="${x}" y="100" width="${width}" height="80" fill="${chartColors[index + 1]}" data-tooltip="${item.name}: ${item.value}"></rect>`; x += width; return markup; }).join(''); const legend = status.map((item, index) => `<text x="${45 + index * 170}" y="220"><tspan fill="${chartColors[index + 1]}">●</tspan> ${item.name} ${item.value}</text>`).join(''); const empty = ordersInWindow.length ? '' : '<text class="chart-empty-label" x="320" y="80" text-anchor="middle">No order statuses yet</text>'; mountChart('statusStackedChart', svgShell(`${bars}${legend}${empty}`, 'Order status stacked bar')); };
		const renderHistogram = (ordersInWindow) => { const values = ordersInWindow.map((order) => Number(order.total) || 0); const maxValue = Math.max(...values, 100); const bucketCount = 6; const counts = Array(bucketCount).fill(0); values.forEach((value) => counts[Math.min(bucketCount - 1, Math.floor((value / maxValue) * bucketCount))]++); const scale = chartScales(counts); const bars = counts.map((count, index) => { const width = 570 / bucketCount - 8; const height = (count / scale.max) * 190; return `<rect class="bar histogram-bar" x="${45 + index * (570 / bucketCount)}" y="${232 - height}" width="${width}" height="${height}" data-tooltip="${count} order${count === 1 ? '' : 's'} in ${formatMoney((index / bucketCount) * maxValue)}-${formatMoney(((index + 1) / bucketCount) * maxValue)}"></rect><text x="${45 + index * (570 / bucketCount) + width / 2}" y="258" text-anchor="middle">${Math.round((index / bucketCount) * maxValue / 100) * 100}</text>`; }).join(''); const empty = ordersInWindow.length ? '' : '<text class="chart-empty-label" x="320" y="150" text-anchor="middle">No order values yet</text>'; mountChart('orderHistogramChart', svgShell(`<g class="chart-grid"><path d="M40 42H610M40 137H610M40 232H610"></path></g>${bars}${empty}`, 'Order value histogram')); };
		const renderScatter = () => { const items = Object.values(productCatalog); const maxPrice = Math.max(...items.map((item) => Number(item.price) || 0), 1); const maxStock = Math.max(...items.map((item) => Number(item.stock) || 0), 1); const points = items.map((item, index) => `<circle class="scatter-point" cx="${45 + ((Number(item.price) || 0) / maxPrice) * 555}" cy="${232 - ((Number(item.stock) || 0) / maxStock) * 190}" r="${4 + (index % 3)}" fill="${chartColors[index % chartColors.length]}" data-tooltip="${escapeHtml(item.name)}: ${formatMoney(Number(item.price) || 0)}, stock ${Number(item.stock) || 0}"></circle>`).join(''); mountChart('stockScatterChart', svgShell(`<g class="chart-grid"><path d="M40 42H610M40 137H610M40 232H610"></path></g>${points}<text x="320" y="275" text-anchor="middle">Price →</text><text x="12" y="140" transform="rotate(-90 12 140)" text-anchor="middle">Stock</text>`, 'Product price versus stock scatter plot')); };
		const renderAnalytics = () => { const windowOrders = filteredOrders(); const margin = Number(document.querySelector('#profitMargin').value) / 100; const revenue = windowOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0); const profit = revenue * margin; const average = windowOrders.length ? revenue / windowOrders.length : 0; const units = windowOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0); analyticsKpis.innerHTML = `<div class="analytics-kpi"><span>Revenue</span><strong>${formatMoney(revenue)}</strong><small>Selected period</small></div><div class="analytics-kpi"><span>Estimated profit</span><strong>${formatMoney(profit)}</strong><small>${Math.round(margin * 100)}% model</small></div><div class="analytics-kpi"><span>Orders</span><strong>${windowOrders.length}</strong><small>Checkout enquiries</small></div><div class="analytics-kpi"><span>Average order</span><strong>${formatMoney(average)}</strong><small>${units} tracked units</small></div>`; const isMonthly = document.querySelector('#analyticsGranularity').value === 'monthly'; const points = isMonthly ? 12 : 8; const now = new Date(); const salesSeries = Array.from({ length: points }, (_, index) => windowOrders.filter((order) => { const date = new Date(order.createdAt); if (Number.isNaN(date.getTime())) return false; if (isMonthly) return date.getFullYear() === now.getFullYear() && date.getMonth() === index; return Math.floor((Date.now() - date.getTime()) / 604800000) === points - index - 1; }).reduce((sum, order) => sum + Number(order.total || 0), 0)); const labels = isMonthly ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : Array.from({ length: points }, (_, index) => `W${index + 1}`); renderLineChart(salesSeries, salesSeries.map((value) => value * margin), labels); const performance = {}; windowOrders.forEach((order) => (order.items || []).forEach((item) => { performance[item.name] ||= 0; performance[item.name] += Number(item.price || 0) * Number(item.quantity || 0); })); const productData = Object.entries(performance).map(([name, sales]) => ({ name, sales, profit: sales * margin })).sort((a, b) => b.sales - a.sales).slice(0, 8); renderClusteredBars(productData.length ? productData : [{ name: 'No orders yet', sales: 0, profit: 0 }]); const categories = {}; windowOrders.forEach((order) => (order.items || []).forEach((item) => { const category = categoryFor(item.name); categories[category] = (categories[category] || 0) + Number(item.price || 0) * Number(item.quantity || 0); })); const categoryData = Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5); renderDonut(categoryData.length ? categoryData : [{ name: 'No sales yet', value: 0 }]); renderStacked(windowOrders); renderHistogram(windowOrders); renderScatter(); };
		const renderProducts = () => {
			const query = document.querySelector('#adminProductSearch').value.trim().toLowerCase();
			const overriddenNames = new Set(products.map((product) => product.name));
			const merged = [...Object.keys(catalog).filter((name) => !overriddenNames.has(name)).map((name) => ({ name, image: catalog[name][0], price: catalog[name][1], originalPrice: catalog[name][1], discountPercent: 0, description: '', stock: 10, builtIn: true })), ...products.map((product) => ({ ...product, builtIn: false }))].filter((product) => product.name.toLowerCase().includes(query));
			productList.innerHTML = merged.map((product) => { const original = Number(product.originalPrice || product.price); const sale = Number(product.price); const percent = discountPercent(product); const priceLabel = original > sale ? `<del>${formatMoney(original)}</del> ${formatMoney(sale)} <em>-${Math.round(percent)}%</em>` : formatMoney(sale); return `<article class="admin-product-row"><img src="${escapeHtml(product.image)}" alt=""><div><strong>${escapeHtml(product.name)}</strong><span>${priceLabel} · ${Number(product.stock) || 0} in stock</span></div><div class="admin-row-actions"><button type="button" class="text-action admin-edit" data-product="${escapeHtml(product.name)}">Edit</button>${product.builtIn ? '' : `<button type="button" class="text-action admin-delete" data-product="${escapeHtml(product.name)}">Delete</button>`}</div></article>`; }).join('') || '<p class="admin-empty">No matching products.</p>';
			productList.querySelectorAll('.admin-edit').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.product)));
			productList.querySelectorAll('.admin-delete').forEach((button) => button.addEventListener('click', () => { if (!window.confirm(`Delete ${button.dataset.product}?`)) return; products = products.filter((product) => product.name !== button.dataset.product); storage.set('joni-products', products); renderProducts(); renderMetrics(); notify('Product deleted'); }));
		};
		const editProduct = (name) => { const product = products.find((item) => item.name === name) || { ...productCatalog[name], name }; const formProduct = { ...product, originalPrice: product.originalPrice || product.price, discountPercent: discountPercent(product) }; Object.entries(formProduct).forEach(([key, value]) => { if (productForm.elements[key]) productForm.elements[key].value = value ?? ''; }); productForm.elements.editingName.value = name; document.querySelector('#productFormTitle').textContent = `Edit ${name}`; document.querySelector('#cancelProductEdit').hidden = false; productForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
		const originalPriceInput = productForm.elements.originalPrice;
		const salePriceInput = productForm.elements.price;
		const discountPercentInput = productForm.elements.discountPercent;
		originalPriceInput.addEventListener('input', () => { const original = Number(originalPriceInput.value); const sale = Number(salePriceInput.value); if (original > 0 && sale >= 0) discountPercentInput.value = Math.max(0, Math.min(100, ((original - sale) / original) * 100)).toFixed(2); });
		salePriceInput.addEventListener('input', () => { const original = Number(originalPriceInput.value); const sale = Number(salePriceInput.value); if (original > 0 && sale >= 0) discountPercentInput.value = Math.max(0, Math.min(100, ((original - sale) / original) * 100)).toFixed(2); });
		discountPercentInput.addEventListener('input', () => { const original = Number(originalPriceInput.value); const percent = Number(discountPercentInput.value); if (original > 0 && percent >= 0 && percent <= 100) salePriceInput.value = (original * (1 - percent / 100)).toFixed(2); });
		productForm.addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(productForm)); const originalPrice = Number(data.originalPrice); const price = Number(data.price); const percent = originalPrice > 0 ? Math.max(0, Math.min(100, ((originalPrice - price) / originalPrice) * 100)) : 0; const product = { name: data.name.trim(), image: data.image.trim(), price, originalPrice, discountPercent: percent, stock: Number(data.stock), description: data.description.trim() }; if (!product.name || !product.image || originalPrice < 0 || price < 0 || price > originalPrice || product.stock < 0) return notify('Enter valid pricing: sale price cannot exceed original price'); const index = products.findIndex((item) => item.name === data.editingName); index >= 0 ? products.splice(index, 1, product) : products.push(product); storage.set('joni-products', products); productForm.reset(); productForm.elements.editingName.value = ''; document.querySelector('#productFormTitle').textContent = 'Add a product'; document.querySelector('#cancelProductEdit').hidden = true; renderProducts(); renderMetrics(); notify('Product saved'); });
		document.querySelector('#cancelProductEdit').addEventListener('click', () => { productForm.reset(); productForm.elements.editingName.value = ''; document.querySelector('#productFormTitle').textContent = 'Add a product'; document.querySelector('#cancelProductEdit').hidden = true; });
		document.querySelector('#newProduct').addEventListener('click', () => { productForm.reset(); productForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
		document.querySelector('#adminProductSearch').addEventListener('input', renderProducts);
		const renderOrders = () => { if (!orders.length) { orderList.innerHTML = '<p class="admin-empty">No orders have been submitted yet.</p>'; return; } orderList.innerHTML = orders.slice().reverse().map((order) => `<article class="admin-order-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><span>${escapeHtml(order.name)} · ${escapeHtml(order.phone)}</span><small>${new Date(order.createdAt).toLocaleString()}</small></div><strong>${formatMoney(Number(order.total))}</strong></article>`).join(''); };
		document.querySelector('#clearOrders').addEventListener('click', () => { if (!orders.length || !window.confirm('Clear all saved order history?')) return; orders = []; storage.set('joni-orders', orders); renderOrders(); renderMetrics(); notify('Order history cleared'); });
		const settingsForm = document.querySelector('#settingsForm'); Object.entries(settings).forEach(([key, value]) => { if (settingsForm.elements[key]) settingsForm.elements[key].value = value; }); settingsForm.addEventListener('submit', (event) => { event.preventDefault(); settings = { ...settings, ...Object.fromEntries(new FormData(settingsForm)) }; storage.set('joni-settings', settings); notify('Site settings saved'); });
		document.querySelectorAll('[data-admin-tab]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-admin-tab], [data-admin-view]').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); document.querySelector(`[data-admin-view="${tab.dataset.adminTab}"]`).classList.add('active'); if (tab.dataset.adminTab === 'orders') renderOrders(); if (tab.dataset.adminTab === 'analytics') renderAnalytics(); }));
		document.querySelector('#analyticsWindow').addEventListener('change', renderAnalytics);
		document.querySelector('#analyticsGranularity').addEventListener('change', renderAnalytics);
		document.querySelector('#profitMargin').addEventListener('input', renderAnalytics);
		document.querySelector('#refreshAnalytics').addEventListener('click', () => { orders = storage.get('joni-orders', []); renderAnalytics(); renderMetrics(); notify('Analytics refreshed'); });
		document.querySelector('#exportStore').addEventListener('click', () => { const data = { products, orders, settings, cart, wishlist, exportedAt: new Date().toISOString() }; const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'joni-medtech-store-backup.json'; link.click(); URL.revokeObjectURL(url); notify('Backup exported'); });
		document.querySelector('#importStore').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.products) || !Array.isArray(data.orders)) throw new Error('Invalid backup'); storage.set('joni-products', data.products); storage.set('joni-orders', data.orders); storage.set('joni-settings', { ...defaultSettings, ...(data.settings || {}) }); location.reload(); } catch { notify('That backup file is not valid'); } }; reader.readAsText(file); });
		document.querySelector('#resetStore').addEventListener('click', () => { if (!window.confirm('Reset products, orders, and settings saved in this browser?')) return; ['joni-products', 'joni-orders', 'joni-settings', 'joni-cart', 'joni-wishlist'].forEach((key) => localStorage.removeItem(key)); location.reload(); });
		renderMetrics(); renderProducts(); renderOrders(); renderAnalytics();
	};

	setupTheme();
	setupAuthNavigation();
	setupNavigation();
	setupNavToggle();
	setupCarousel();
	setupStoreCatalog();
	setupSearch();
	setupWishlist();
	setupCart();
	setupReviews();
	setupPopupTriggers();
	setupContactForm();
	setupAdmin();
	updateBadges();
	syncSupabaseProducts();
})();
