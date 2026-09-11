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
	updateBadges();
})();
