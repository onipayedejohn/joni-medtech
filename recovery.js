(() => {
    'use strict';
    const client = window.supabaseClient;
    const message = document.querySelector('#recoveryMessage');
    const show = (text, type = 'error') => { message.textContent = text; message.className = `auth-message visible ${type}`; };
    const strong = (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

    document.querySelectorAll('.password-toggle').forEach((button) => button.addEventListener('click', () => {
        const input = document.querySelector(`#${button.dataset.target}`);
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'Show' : 'Hide';
    }));

    document.querySelector('#forgotForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!client) return show('Password recovery is temporarily unavailable.');
        const email = new FormData(event.currentTarget).get('email');
        const redirectTo = `${location.origin}${location.pathname.replace(/[^/]+$/, 'reset-password.html')}`;
        const { error } = await client.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo });
        if (error) return show('We could not send the recovery request. Please try again later.');
        show('If an account matches that address, recovery instructions have been sent.', 'success');
        event.currentTarget.reset();
    });

    document.querySelector('#resetForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!client) return show('Password recovery is temporarily unavailable.');
        const data = new FormData(event.currentTarget);
        const password = String(data.get('password'));
        if (!strong(password) || password !== data.get('confirmPassword')) return show('Passwords must match and meet the stated requirements.');
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) return show('This recovery link is missing, expired, or has already been used.');
        const { error } = await client.auth.updateUser({ password });
        if (error) return show('This recovery link is invalid or expired. Request a new one.');
        await client.auth.signOut();
        show('Password updated successfully. You can now sign in.', 'success');
        event.currentTarget.querySelector('button[type="submit"]').disabled = true;
    });

    client?.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') show('Recovery session verified. Choose your new password.', 'success'); });
})();
