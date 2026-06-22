// Public browser config for Lazy Acres Timer.
// The Supabase URL and anon/publishable key are safe to use in the browser ONLY when Row Level Security is enabled.
// Never put a service_role key, database password, JWT secret, or other private key here.
window.LAZY_TIMER_CONFIG = {
  appVersion: 'v0.1.0',
  versionUrl: './version.json',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseClientUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
};
