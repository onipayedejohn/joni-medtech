(() => {
    'use strict';

    const client = window.supabaseClient;
    const form = document.querySelector('#statusForm');
    const message = document.querySelector('#statusMessage');
    const result = document.querySelector('#statusResult');
    const notice = document.querySelector('#statusAuthNotice');
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const formatMoney = (value) => `GH₵${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const setMessage = (text, type = 'error') => { message.textContent = text; message.className = `status-message visible ${type}`; };
    const setLoading = (loading) => { const button = form.querySelector('button'); button.disabled = loading; button.textContent = loading ? 'Checking...' : 'Check order status'; };

    const renderResult = (order) => {
        const status = String(order.status || 'pending').toLowerCase();
        const steps = ['pending', 'confirmed', 'processing', 'completed'];
        const current = steps.indexOf(status);
        result.hidden = false;
        result.innerHTML = `<div class="status-result-heading"><div><span class="status-eyebrow">${escapeHtml(order.order_number)}</span><h2>Order status</h2><p>Placed ${new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><span class="order-status status-${escapeHtml(status)}">${escapeHtml(status)}</span></div><div class="status-timeline">${steps.map((step, index) => `<div class="status-step ${index <= current ? 'complete' : ''} ${index === current ? 'current' : ''}"><span>${index < current ? '✓' : index + 1}</span><strong>${step}</strong></div>`).join('')}</div><div class="status-order-summary"><div><span>Order total</span><strong>${formatMoney(order.total)}</strong></div><div><span>Delivery location</span><strong>${escapeHtml(order.delivery_location || 'Being confirmed')}</strong></div></div><div class="status-items">${(order.order_items || []).map((item) => `<div><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${formatMoney(item.line_total)}</strong></div>`).join('') || '<p>Item details are unavailable for this order.</p>'}</div>`;
    };

    const init = async () => {
        if (!client) { notice.hidden = false; form.querySelector('button').disabled = true; return; }
        const { data } = await client.auth.getSession();
        if (!data.session) { notice.hidden = false; form.querySelector('button').disabled = true; }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.className = 'status-message';
        result.hidden = true;
        if (!client) return setMessage('Order tracking is temporarily unavailable.');
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) return location.assign('auth.html?next=status.html');
        const values = Object.fromEntries(new FormData(form));
        setLoading(true);
        const { data, error } = await client.rpc('lookup_order_status', { p_order_number: values.orderNumber.trim().toUpperCase(), p_customer_email: values.email.trim().toLowerCase() });
        setLoading(false);
        if (error || !data?.length) return setMessage('We could not find an order matching those details.');
        renderResult(data[0]);
    });

    init();
})();
