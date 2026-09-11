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
	const productCatalog = Object.fromEntries(Object.entries(catalog).map(([name, [image, price]]) => [name, { name, image, price, description: '', stock: 10 }]));
	savedProducts.forEach((product) => { if (product.name) productCatalog[product.name] = { ...productCatalog[product.name], ...product }; });
	const formatMoney = (amount) => `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
				button.textContent = dark ? '☀' : '☾';
				button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
				button.setAttribute('aria-pressed', String(dark));
			});
		};
		applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
		document.querySelectorAll('.theme-toggle').forEach((button) => button.addEventListener('click', () => {
			const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
			storage.set('joni-theme', theme);
			applyTheme(theme);
		}));
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
			card.querySelector('.stock-text').textContent = `${Number(product.stock) || 0} items left`;
			card.querySelector('.stock-bar').style.width = `${Math.min(100, Math.max(5, Number(product.stock) * 3))}%`;
		});
		Object.values(productCatalog).filter((product) => !existingNames.has(product.name)).forEach((product) => {
			const card = document.createElement('article');
			card.className = 'product-item';
			card.dataset.productName = product.name;
			card.innerHTML = `<div class="product-image-wrapper"><img src="${product.image}" alt="${product.name}"><button class="wishlist-button" type="button" aria-label="Add ${product.name} to wishlist">♡</button></div><h2>${product.name}</h2><p class="product-description">${product.description || 'Medical laboratory product supplied by Joni Medtech Supply.'}</p><div class="product-price"><span class="discount-price">${formatMoney(Number(product.price))}</span></div><div class="stock-info"><span class="stock-text">${Number(product.stock) || 0} items left</span><div class="stock-progress"><span class="stock-bar stock-high" style="width: ${Math.min(100, Math.max(5, Number(product.stock) * 3))}%;"></span></div></div><button class="add-cart-button" type="button">Add to Cart</button>`;
			productList.append(card);
		});
		productCards = [...productList.querySelectorAll('.product-item')];
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
		carousel.addEventListener('mouseenter', () => clearInterval(timer));
		carousel.addEventListener('mouseleave', restart);
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
		document.querySelectorAll('.add-cart-button').forEach((button) => button.addEventListener('click', () => {
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
			summaryRoot.querySelector('.checkout-start').addEventListener('click', () => { checkoutPanel.hidden = false; checkoutPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
		};
		renderCartPage();
		document.querySelector('#cancelCheckout')?.addEventListener('click', () => { checkoutPanel.hidden = true; });
		document.querySelector('#checkoutForm')?.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!Object.keys(cart).length) return;
			const data = new FormData(event.currentTarget);
			const orderNumber = `JONI-${Date.now().toString().slice(-6)}`;
			const order = { orderNumber, name: data.get('name'), email: data.get('email'), phone: data.get('phone'), location: data.get('location'), notes: data.get('notes'), total: cartSubtotal(), createdAt: new Date().toISOString() };
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

	const setupAdmin = () => {
		if (!document.querySelector('.admin-page')) return;
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
		const renderProducts = () => {
			const query = document.querySelector('#adminProductSearch').value.trim().toLowerCase();
			const overriddenNames = new Set(products.map((product) => product.name));
			const merged = [...Object.keys(catalog).filter((name) => !overriddenNames.has(name)).map((name) => ({ name, image: catalog[name][0], price: catalog[name][1], description: '', stock: 10, builtIn: true })), ...products.map((product) => ({ ...product, builtIn: false }))].filter((product) => product.name.toLowerCase().includes(query));
			productList.innerHTML = merged.map((product) => `<article class="admin-product-row"><img src="${escapeHtml(product.image)}" alt=""><div><strong>${escapeHtml(product.name)}</strong><span>${formatMoney(Number(product.price))} · ${Number(product.stock) || 0} in stock</span></div><div class="admin-row-actions"><button type="button" class="text-action admin-edit" data-product="${escapeHtml(product.name)}">Edit</button>${product.builtIn ? '' : `<button type="button" class="text-action admin-delete" data-product="${escapeHtml(product.name)}">Delete</button>`}</div></article>`).join('') || '<p class="admin-empty">No matching products.</p>';
			productList.querySelectorAll('.admin-edit').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.product)));
			productList.querySelectorAll('.admin-delete').forEach((button) => button.addEventListener('click', () => { if (!window.confirm(`Delete ${button.dataset.product}?`)) return; products = products.filter((product) => product.name !== button.dataset.product); storage.set('joni-products', products); renderProducts(); renderMetrics(); notify('Product deleted'); }));
		};
		const editProduct = (name) => { const product = products.find((item) => item.name === name) || { ...productCatalog[name], name }; Object.entries(product).forEach(([key, value]) => { if (productForm.elements[key]) productForm.elements[key].value = value ?? ''; }); productForm.elements.editingName.value = name; document.querySelector('#productFormTitle').textContent = `Edit ${name}`; document.querySelector('#cancelProductEdit').hidden = false; productForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
		productForm.addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(productForm)); const product = { name: data.name.trim(), image: data.image.trim(), price: Number(data.price), stock: Number(data.stock), description: data.description.trim() }; if (!product.name || !product.image || product.price < 0 || product.stock < 0) return; const index = products.findIndex((item) => item.name === data.editingName); index >= 0 ? products.splice(index, 1, product) : products.push(product); storage.set('joni-products', products); productForm.reset(); productForm.elements.editingName.value = ''; document.querySelector('#productFormTitle').textContent = 'Add a product'; document.querySelector('#cancelProductEdit').hidden = true; renderProducts(); renderMetrics(); notify('Product saved'); });
		document.querySelector('#cancelProductEdit').addEventListener('click', () => { productForm.reset(); productForm.elements.editingName.value = ''; document.querySelector('#productFormTitle').textContent = 'Add a product'; document.querySelector('#cancelProductEdit').hidden = true; });
		document.querySelector('#newProduct').addEventListener('click', () => { productForm.reset(); productForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
		document.querySelector('#adminProductSearch').addEventListener('input', renderProducts);
		const renderOrders = () => { if (!orders.length) { orderList.innerHTML = '<p class="admin-empty">No orders have been submitted yet.</p>'; return; } orderList.innerHTML = orders.slice().reverse().map((order) => `<article class="admin-order-row"><div><strong>${escapeHtml(order.orderNumber)}</strong><span>${escapeHtml(order.name)} · ${escapeHtml(order.phone)}</span><small>${new Date(order.createdAt).toLocaleString()}</small></div><strong>${formatMoney(Number(order.total))}</strong></article>`).join(''); };
		document.querySelector('#clearOrders').addEventListener('click', () => { if (!orders.length || !window.confirm('Clear all saved order history?')) return; orders = []; storage.set('joni-orders', orders); renderOrders(); renderMetrics(); notify('Order history cleared'); });
		const settingsForm = document.querySelector('#settingsForm'); Object.entries(settings).forEach(([key, value]) => { if (settingsForm.elements[key]) settingsForm.elements[key].value = value; }); settingsForm.addEventListener('submit', (event) => { event.preventDefault(); settings = { ...settings, ...Object.fromEntries(new FormData(settingsForm)) }; storage.set('joni-settings', settings); notify('Site settings saved'); });
		document.querySelectorAll('[data-admin-tab]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-admin-tab], [data-admin-view]').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); document.querySelector(`[data-admin-view="${tab.dataset.adminTab}"]`).classList.add('active'); if (tab.dataset.adminTab === 'orders') renderOrders(); }));
		document.querySelector('#exportStore').addEventListener('click', () => { const data = { products, orders, settings, cart, wishlist, exportedAt: new Date().toISOString() }; const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'joni-medtech-store-backup.json'; link.click(); URL.revokeObjectURL(url); notify('Backup exported'); });
		document.querySelector('#importStore').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.products) || !Array.isArray(data.orders)) throw new Error('Invalid backup'); storage.set('joni-products', data.products); storage.set('joni-orders', data.orders); storage.set('joni-settings', { ...defaultSettings, ...(data.settings || {}) }); location.reload(); } catch { notify('That backup file is not valid'); } }; reader.readAsText(file); });
		document.querySelector('#resetStore').addEventListener('click', () => { if (!window.confirm('Reset products, orders, and settings saved in this browser?')) return; ['joni-products', 'joni-orders', 'joni-settings', 'joni-cart', 'joni-wishlist'].forEach((key) => localStorage.removeItem(key)); location.reload(); });
		renderMetrics(); renderProducts(); renderOrders();
	};

	setupTheme();
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
})();
