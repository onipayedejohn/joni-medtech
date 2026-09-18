(() => {
    'use strict';

    const client = window.supabaseClient;
    const nextPath = new URLSearchParams(location.search).get('next');
    const safeNext = nextPath && /^\/(?!\/)|^[a-z0-9_-]+\.html(?:[?#].*)?$/i.test(nextPath) ? nextPath : 'shop.html';
    const form = document.querySelector('#authForm');
    const message = document.querySelector('#authMessage');
    const submit = document.querySelector('#authSubmit');
    const signupFields = document.querySelector('#signupFields');
    const confirmField = document.querySelector('#confirmField');
    const termsField = document.querySelector('#termsField');
    const authTitle = document.querySelector('#authTitle');
    const authSubtitle = document.querySelector('#authSubtitle');
    let mode = 'signin';

    const showMessage = (text, type = 'error') => { message.textContent = text; message.className = `auth-message visible ${type}`; };
    const clearMessage = () => { message.textContent = ''; message.className = 'auth-message'; };
    const setLoading = (loading) => { submit.disabled = loading; submit.textContent = loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'; };
    const setMode = (nextMode) => {
        mode = nextMode;
        const signup = mode === 'signup';
        signupFields.hidden = !signup;
        confirmField.hidden = !signup;
        termsField.hidden = !signup;
        authTitle.textContent = signup ? 'Create your account' : 'Welcome back';
        authSubtitle.textContent = signup ? 'Create a secure account to manage orders and saved products.' : 'Sign in to continue to Joni Medtech Supply.';
        document.querySelectorAll('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
        document.querySelector('#signinOptions').hidden = signup;
        document.querySelector('#passwordFeedback').hidden = !signup;
        submit.disabled = signup && !document.querySelector('#terms').checked;
        clearMessage();
        setLoading(false);
    };
    const passwordIsStrong = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

    document.querySelectorAll('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
    document.querySelectorAll('.password-toggle').forEach((button) => button.addEventListener('click', () => {
        const input = document.querySelector(`#${button.dataset.target}`);
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        button.textContent = visible ? 'Show' : 'Hide';
        button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    }));
    document.querySelector('#password')?.addEventListener('input', (event) => {
        const feedback = document.querySelector('#passwordFeedback');
        feedback.textContent = passwordIsStrong(event.target.value) ? 'Strong password.' : 'Use at least 8 characters with uppercase, lowercase, and a number.';
    });
    document.querySelector('#terms')?.addEventListener('change', (event) => { submit.disabled = mode === 'signup' && !event.target.checked; });

    document.querySelector('#googleButton')?.addEventListener('click', async () => {
        if (!client) return showMessage('Authentication is temporarily unavailable.');
        const redirectTo = `${location.origin}${location.pathname.replace(/[^/]+$/, 'auth.html')}?next=${encodeURIComponent(safeNext)}`;
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        if (error) showMessage('Google sign-in was cancelled or could not be started.');
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessage();
        if (!client) return showMessage('Authentication is temporarily unavailable.');
        const data = new FormData(form);
        const email = String(data.get('email')).trim().toLowerCase();
        const password = String(data.get('password'));
        if (mode === 'signup' && (!passwordIsStrong(password) || password !== data.get('confirmPassword'))) return showMessage('Check your password requirements and confirmation.');
        setLoading(true);
        const result = mode === 'signin'
            ? await client.auth.signInWithPassword({ email, password })
            : await client.auth.signUp({ email, password, options: { data: { full_name: String(data.get('fullName')).trim() } } });
        if (result.error) { setLoading(false); return showMessage('We could not complete that request. Check your details and try again.'); }
        if (mode === 'signup' && !result.data.session) { setLoading(false); return showMessage('Account created. Check your email to confirm your account.', 'success'); }
        location.assign(safeNext);
    });

    document.querySelector('#forgotLink')?.addEventListener('click', (event) => { event.preventDefault(); location.assign(`forgot-password.html?next=${encodeURIComponent(safeNext)}`); });

    const handleSession = async () => {
        if (!client) return;
        const authError = new URLSearchParams(location.search).get('error_description');
        if (authError) showMessage('Google sign-in was cancelled or could not be completed.');
        const { data } = await client.auth.getSession();
        if (!data.session) return;
        const { data: profile } = await client.from('profiles').select('role, is_active').eq('id', data.session.user.id).maybeSingle();
        if (profile?.is_active === false) { await client.auth.signOut(); return showMessage('This account is disabled. Contact support.'); }
        location.assign(profile?.role === 'admin' ? 'admin.html' : safeNext);
    };
    handleSession();
})();
