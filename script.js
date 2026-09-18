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
		'Anti Sera ABO Blood Grouping Reagents': ['images/Anti Sera ABO Blood grouping reagents.jfif', 27],
		'Urine Dipstick': ['images/urine dipstick.jfif', 13.5],
		'5 Part Hematology Analyzer': ['images/5 part hematology analyzer.jfif', 36818.2],
		'Centrifuge': ['images/centrifuge.jfif', 3218.4],
		'Bacteria Culture Media': ['images/Bacteria culture media.jfif', 1080],
		'Clinical Chemistry Analyzer': ['images/Clinical chemistry analyzer.jfif', 43638.25],
		'GeneXpert PCR': ['images/geneXpert PCR.jfif', 34519.2],
		'CPDA Blood Transfusion Bag': ['images/CPDA Blood transfusion bag.jfif', 384.3],
		'HB Electrophoresis Device': ['images/HB electrophoresis device.jfif', 2455.2],
		'HIV OraQuick': ['images/HIV Oraquick.jfif', 51.3],
		'Disposable Nose Masks': ['images/Disposable nose masks.jfif', 40.5],
		'EDTA Blood Collection Tube': ['images/EDTA blood collection tube.jfif', 57.6],
		'Hepatitis B Profile Kit': ['images/Hepatitis B profile kit.jfif', 30.6],
		'Semi-Automated Hematology Analyzer': ['images/Semi-atomatated hematology analyzer.jfif', 9088.65],
		'Semi-Automated Chemistry Analyzer': ['images/Semi-automated chemistry analyzer.jfif', 8537.65],
		'Zeiss Promorstar Light Microscope': ['images/Zeiss Promorstar light microscope.jfif', 8346.7],
		'Giemsa Solution': ['images/giemsa solution.jfif', 43.2],
		'MicroPipette': ['images/microPipette.jfif', 23.4],
		'Malaria RDT': ['images/malaria RDT.jfif', 19.8],
		'Latex Examination Gloves': ['images/latex examination gloves.jfif', 40.5],
		'White Laboratory Coat': ['images/White Laboratory coat.jfif', 74.7],
		'Syringe and Needle': ['images/syringe and needle.jfif', 31.5],
		'Serum Gel Separator Tubes': ['images/Serum gel separator tubes.jfif', 46.8]
	};
	const savedProducts = storage.get('joni-products', []);
	const defaultSettings = { businessName: 'Joni Medtech Supply', phone: '+233 24 969 8992', email: 'onipayedejohn11@gmail.com', location: 'Obuasi, Ashanti Region, Ghana', announcement: '' };
	const productCatalog = Object.fromEntries(Object.entries(catalog).map(([name, [image, price]]) => [name, { name, image, price, originalPrice: price, discountPercent: 0, description: '', stock: 10 }]));
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

	const setupAuthNavigation = async () => {
		const navigation = document.querySelector('.header-actions');
		if (!navigation) return;
		const existingLink = navigation.querySelector('.auth-nav-link');
		const link = existingLink || document.createElement('a');
		link.className = 'auth-nav-link';
		link.href = 'auth.html';
		link.textContent = 'Login';
		const session = await getAuthenticatedSession();
		if (session) {
			link.textContent = 'Account';
			link.href = 'account.html';
			const { data: profile } = await supabaseClient.from('profiles').select('role, is_active').eq('id', session.user.id).maybeSingle();
			if (profile?.is_active === true && profile.role === 'admin' && !navigation.querySelector('.admin-nav-link')) {
				const adminLink = document.createElement('a');
				adminLink.href = 'admin.html';
				adminLink.className = 'admin-nav-link';
				adminLink.textContent = 'Admin';
				navigation.prepend(adminLink);
			}
		}
		if (!existingLink) navigation.append(link);
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
		const openCart = (event) => { event.preventDefault(); renderCart(); document.querySelector('.cart-drawer')?.classList.add('open'); };
		document.querySelectorAll('a[href*="#cart"]').forEach((link) => link.addEventListener('click', openCart));
	};

	const cartSubtotal = () => Object.entries(cart).reduce((total, [name, quantity]) => total + (productCatalog[name]?.price || 0) * quantity, 0);

	const setupCommercePages = () => {
		const wishlistRoot = document.querySelector('#wishlistPageItems');
		if (wishlistRoot) {
			const renderWishlist = () => {
				wishlistRoot.replaceChildren();
				if (!wishlist.length) {
					wishlistRoot.innerHTML = '<div class="commerce-empty"><strong>Your wishlist is waiting for products.</strong><p>Save products from the shop and they will appear here.</p><a class="primary-action" href="shop.html">Explore the shop</a></div>';
					return;
				}
				wishlist.filter((name) => productCatalog[name]).forEach((name) => {
					const { image, price } = productCatalog[name];
					const card = document.createElement('article');
					card.className = 'wishlist-card';
					card.innerHTML = `<img src="${image}" alt="${name}"><div class="wishlist-card-body"><h2>${name}</h2><strong>${formatMoney(price)}</strong><div class="wishlist-card-actions"><button type="button" class="primary-action wishlist-add">Add to cart</button><button type="button" class="text-action wishlist-remove">Remove</button></div></div>`;
					card.querySelector('.wishlist-add').addEventListener('click', () => { cart[name] = (cart[name] || 0) + 1; storage.set('joni-cart', cart); updateBadges(); showToast(`${name} added to cart`); });
					card.querySelector('.wishlist-remove').addEventListener('click', () => { wishlist.splice(wishlist.indexOf(name), 1); storage.set('joni-wishlist', wishlist); updateBadges(); renderWishlist(); });
					wishlistRoot.append(card);
				});
			};
			renderWishlist();
		}

		const cartRoot = document.querySelector('#cartPageItems');
		const summaryRoot = document.querySelector('#orderSummary');
		const checkoutPanel = document.querySelector('#checkoutPanel');
		if (!cartRoot || !summaryRoot) return;
		const renderCartPage = () => {
			cartRoot.replaceChildren();
			const names = Object.keys(cart).filter((name) => productCatalog[name] && cart[name] > 0);
			if (!names.length) {
				cartRoot.innerHTML = '<div class="commerce-empty"><strong>Your cart is empty.</strong><p>Add products from the shop to begin your order.</p><a class="primary-action" href="shop.html">Continue shopping</a></div>';
				summaryRoot.innerHTML = '<h2>Order summary</h2><p class="summary-empty">Your order total will appear here.</p>';
				return;
			}
			names.forEach((name) => {
				const { image, price } = productCatalog[name];
				const row = document.createElement('article');
				row.className = 'cart-page-row';
				row.innerHTML = `<img src="${image}" alt="${name}"><div class="cart-page-product"><h2>${name}</h2><span>${formatMoney(price)} each</span><button type="button" class="text-action cart-remove">Remove</button></div><div class="quantity-control"><button type="button" aria-label="Decrease ${name} quantity" class="quantity-decrease">−</button><output>${cart[name]}</output><button type="button" aria-label="Increase ${name} quantity" class="quantity-increase">+</button></div><strong class="cart-line-total">${formatMoney(price * cart[name])}</strong>`;
				row.querySelector('.quantity-decrease').addEventListener('click', () => { cart[name] -= 1; if (cart[name] <= 0) delete cart[name]; storage.set('joni-cart', cart); updateBadges(); renderCartPage(); });
				row.querySelector('.quantity-increase').addEventListener('click', () => { cart[name] += 1; storage.set('joni-cart', cart); updateBadges(); renderCartPage(); });
				row.querySelector('.cart-remove').addEventListener('click', () => { delete cart[name]; storage.set('joni-cart', cart); updateBadges(); renderCartPage(); });
				cartRoot.append(row);
			});
			const subtotal = cartSubtotal();
			summaryRoot.innerHTML = `<h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></div><div class="summary-line"><span>Delivery</span><span>Confirmed after enquiry</span></div><div class="summary-total"><span>Total before delivery</span><strong>${formatMoney(subtotal)}</strong></div><button type="button" class="primary-action checkout-start">Continue to checkout</button><p class="summary-note">Your order is confirmed by our team before payment or delivery.</p>`;
			summaryRoot.querySelector('.checkout-start').addEventListener('click', async () => { if (!await requireAuthentication()) return; checkoutPanel.hidden = false; checkoutPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
		};
		renderCartPage();
		document.querySelector('#cancelCheckout')?.addEventListener('click', () => { checkoutPanel.hidden = true; });
		document.querySelector('#checkoutForm')?.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (!Object.keys(cart).length) return;
			if (!await requireAuthentication()) return;
			const data = new FormData(event.currentTarget);
			const orderNumber = `JONI-${Date.now().toString().slice(-6)}`;
			const order = { orderNumber, name: data.get('name'), email: data.get('email'), phone: data.get('phone'), location: data.get('location'), notes: data.get('notes'), total: cartSubtotal(), items: Object.entries(cart).map(([name, quantity]) => ({ name, quantity, price: productCatalog[name]?.price || 0 })), createdAt: new Date().toISOString() };
			if (supabaseClient) {
				const { data: remoteProducts } = await supabaseClient.from('products').select('id, name').in('name', Object.keys(cart));
				if (remoteProducts?.length === Object.keys(cart).length) {
					const remoteItems = Object.entries(cart).map(([name, quantity]) => ({ product_id: remoteProducts.find((product) => product.name === name).id, quantity }));
					const { data: remoteOrder, error } = await supabaseClient.rpc('create_order', { p_customer_name: order.name, p_customer_email: order.email, p_customer_phone: order.phone, p_delivery_location: order.location, p_notes: order.notes, p_items: remoteItems });
					if (error) { showToast('We could not submit the order. Please try again.'); return; }
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
			checkoutPanel.hidden = true;
			document.querySelector('#orderConfirmation').hidden = false;
			document.querySelector('#orderConfirmation').innerHTML = `<span class="section-label">ORDER RECEIVED</span><h2>Thank you, ${data.get('name')}.</h2><p>Your enquiry <strong>${orderNumber}</strong> has been received. We will contact you at ${data.get('phone')} to confirm availability, delivery, and payment.</p><a class="primary-action" href="shop.html">Return to shop</a>`;
			renderCartPage();
			document.querySelector('#orderConfirmation').scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	};

	const renderCart = () => {
		let drawer = document.querySelector('.cart-drawer');
		if (!drawer) {
			drawer = document.createElement('aside');
			drawer.className = 'cart-drawer';
			drawer.setAttribute('aria-label', 'Shopping cart');
			document.body.append(drawer);
		}
		drawer.replaceChildren();
		const heading = document.createElement('div');
		heading.className = 'cart-drawer-header';
		heading.innerHTML = '<h2>Your Cart</h2><button type="button" class="cart-close" aria-label="Close cart">×</button>';
		drawer.append(heading);
		const names = Object.keys(cart);
		if (!names.length) {
			const empty = document.createElement('p');
			empty.className = 'cart-empty';
			empty.textContent = 'Your cart is empty.';
			drawer.append(empty);
		} else {
			const list = document.createElement('div');
			list.className = 'cart-items';
			names.forEach((name) => {
				const row = document.createElement('div');
				row.className = 'cart-row';
				row.innerHTML = `<span>${name}</span><strong>×${cart[name]}</strong><button type="button" aria-label="Remove ${name}">Remove</button>`;
				row.querySelector('button').addEventListener('click', () => { delete cart[name]; storage.set('joni-cart', cart); updateBadges(); renderCart(); });
				list.append(row);
			});
			drawer.append(list);
		}
		heading.querySelector('.cart-close').addEventListener('click', () => drawer.classList.remove('open'));
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
	setupCarousel();
	setupStoreCatalog();
	setupSearch();
	setupWishlist();
	setupCart();
	setupContactForm();
	setupCommercePages();
	setupAdmin();
	updateBadges();
	syncSupabaseProducts();
})();
