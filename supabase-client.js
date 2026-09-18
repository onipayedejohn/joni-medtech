/* Public browser client only. Keep server credentials out of this file. */
(() => {
    const config = {
        url: 'https://bdlpktqipuskesfkwvlr.supabase.co',
        publishableKey: 'sb_publishable_Yi8Sxp6HHxVGY4ZnoiROWA_edDkHpHb'
    };

    if (!window.supabase?.createClient) {
        console.warn('Supabase client library is unavailable. Local storage mode remains active.');
        return;
    }

    window.supabaseClient = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
})();
