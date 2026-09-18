(() => {
    'use strict';

    const client = window.supabaseClient;
    const loading = document.querySelector('#accountLoading');
    const unauthenticated = document.querySelector('#accountUnauthenticated');
    const content = document.querySelector('#accountContent');
    const message = document.querySelector('#accountMessage');
    const formatMoney = (value) => `GH₵${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const showMessage = (text, type = 'success') => { message.textContent = text; message.className = `account-message visible ${type}`; };

    const renderOrders = (orders) => {
        const root = document.querySelector('#accountOrders');
        document.querySelector('#orderCount').textContent = orders.length;
        document.querySelector('#accountSpend').textContent = formatMoney(orders.reduce((total, order) => total + Number(order.total || 0), 0));
        if (!orders.length) {
            root.innerHTML = '<div class="account-empty"><strong>No orders yet</strong><p>Your completed orders will appear here.</p><a class="secondary-action" href="shop.html">Browse the shop →</a></div>';
            return;
        }
        root.innerHTML = orders.map((order) => `<article class="account-order"><div class="account-order-top"><div><strong>${escapeHtml(order.order_number)}</strong><span>${new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></div><div class="account-order-meta"><span class="order-status status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span><strong>${formatMoney(order.total)}</strong></div></div><div class="account-order-items">${(order.order_items || []).map((item) => `<div><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${formatMoney(item.line_total)}</strong></div>`).join('') || '<span class="account-muted">Item details unavailable for this order.</span>'}</div>${order.delivery_location ? `<p class="account-delivery">Delivery: ${escapeHtml(order.delivery_location)}</p>` : ''}</article>`).join('');
    };

    const loadAccount = async () => {
        if (!client) { loading.hidden = true; unauthenticated.hidden = false; return; }
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) { loading.hidden = true; unauthenticated.hidden = false; return; }
        const user = sessionData.session.user;
        const [{ data: profile, error: profileError }, { data: orders, error: ordersError }] = await Promise.all([
            client.from('profiles').select('full_name, role, is_active').eq('id', user.id).maybeSingle(),
            client.from('orders').select('id, order_number, status, total, delivery_location, created_at, order_items(product_name, quantity, line_total)').eq('user_id', user.id).order('created_at', { ascending: false })
        ]);
        if (profileError || ordersError || profile?.is_active === false) { loading.hidden = true; showMessage('We could not load your account right now. Please try again.', 'error'); content.hidden = false; return; }
        const name = profile?.full_name || user.user_metadata?.full_name || 'Customer';
        document.querySelector('#accountName').textContent = name.split(' ')[0];
        document.querySelector('#profileName').value = name;
        document.querySelector('#profileEmail').value = user.email || '';
        const displayRole = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Customer';
        document.querySelector('#accountRole').textContent = displayRole;
        document.querySelector('#wishlistTotal').textContent = JSON.parse(localStorage.getItem('joni-wishlist') || '[]').length;
        renderOrders(orders || []);
        document.querySelector('#ordersUpdated').textContent = orders?.length ? `Updated ${new Date().toLocaleDateString()}` : '';
        loading.hidden = true;
        content.hidden = false;
    };

    document.querySelector('#profileForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!client) return;
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        const fullName = new FormData(event.currentTarget).get('fullName').trim();
        const { error } = await client.from('profiles').update({ full_name: fullName }).eq('id', (await client.auth.getUser()).data.user.id);
        button.disabled = false;
        if (error) return showMessage('We could not save your profile changes.', 'error');
        document.querySelector('#accountName').textContent = fullName.split(' ')[0] || 'Customer';
        showMessage('Profile updated successfully.');
    });

    document.querySelector('#logoutButton')?.addEventListener('click', async (event) => {
        event.currentTarget.disabled = true;
        const { error } = await client.auth.signOut();
        if (error) { event.currentTarget.disabled = false; return showMessage('We could not log you out. Please try again.', 'error'); }
        location.assign('auth.html');
    });

    loadAccount();
})();
