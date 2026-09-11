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
	const formatMoney = (amount) => `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const productCards = [...document.querySelectorAll('.product-item')];
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

	const cartSubtotal = () => Object.entries(cart).reduce((total, [name, quantity]) => total + (catalog[name]?.[1] || 0) * quantity, 0);

	const setupCommercePages = () => {
		const wishlistRoot = document.querySelector('#wishlistPageItems');
		if (wishlistRoot) {
			const renderWishlist = () => {
				wishlistRoot.replaceChildren();
				if (!wishlist.length) {
					wishlistRoot.innerHTML = '<div class="commerce-empty"><strong>Your wishlist is waiting for products.</strong><p>Save products from the shop and they will appear here.</p><a class="primary-action" href="shop.html">Explore the shop</a></div>';
					return;
				}
				wishlist.filter((name) => catalog[name]).forEach((name) => {
					const [image, price] = catalog[name];
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
			const names = Object.keys(cart).filter((name) => catalog[name] && cart[name] > 0);
			if (!names.length) {
				cartRoot.innerHTML = '<div class="commerce-empty"><strong>Your cart is empty.</strong><p>Add products from the shop to begin your order.</p><a class="primary-action" href="shop.html">Continue shopping</a></div>';
				summaryRoot.innerHTML = '<h2>Order summary</h2><p class="summary-empty">Your order total will appear here.</p>';
				return;
			}
			names.forEach((name) => {
				const [image, price] = catalog[name];
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
			storage.set('joni-last-order', { orderNumber, name: data.get('name'), total: cartSubtotal(), createdAt: new Date().toISOString() });
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

	setupNavigation();
	setupCarousel();
	setupSearch();
	setupWishlist();
	setupCart();
	setupContactForm();
	setupCommercePages();
	updateBadges();
})();
