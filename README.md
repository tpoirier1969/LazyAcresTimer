# Lazy Acres Timer

Lazy Acres Timer is a local-first project/job timer for Tod and Donna's Lazy Acres app family.

## v0.1.0 scope

- Project/job timers with multiple concurrent running sessions supported.
- Project detail pages with notes, settings, sessions, manual edits, archive, and billing totals.
- Project types seeded per user:
  - Milling — $100/hr
  - Computer Work — $25/hr
- Project rates are copied from the selected type when the project is created, then can be overridden.
- Billable yes/no per project.
- 10-hour cap per project, default on.
- Idle warning every 2 hours by default.
- Reports with CSV export.
- Stopwatch, countdown timer, and a basic time-code calculator scaffold.
- Local/offline storage first, with a visible sync button once Supabase is configured and the user signs in.
- Forced version check via `version.json`.

## Public config

The browser app reads `assets/config.js`.

Fill in:

```js
window.LAZY_TIMER_CONFIG = {
  appVersion: 'v0.1.0',
  versionUrl: './version.json',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-OR-PUBLISHABLE-KEY',
  supabaseClientUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
};
```

The Supabase URL and anon/publishable key are public browser values. Do **not** put a `service_role` key, database password, JWT secret, or any private credential in this repo.

## Supabase setup

Do not run the SQL until you are ready to connect Supabase.

When ready, run:

```text
supabase/001_lazy_timer_schema.sql
```

The SQL creates these prefixed tables:

- `lazy_timer_project_types`
- `lazy_timer_projects`
- `lazy_timer_sessions`
- `lazy_timer_settings`

RLS is enabled on all tables. Policies are owner-only using `user_id = auth.uid()`.

## GitHub Pages

After files exist on `main`, enable Pages:

```text
Settings → Pages → Deploy from a branch → main → /root
```

Expected URL:

```text
https://tpoirier1969.github.io/LazyAcresTimer/
```

## Lazy Acres Suite landing card

This repo contains the Timer app itself. The compact Lazy Acres Suite landing-page card should be wired separately after this app is deployed and Supabase is connected.

Target compact card behavior:

```text
History Museum Kiosk   01:14:32   [Stop]
+2 more                [Open]
```

If inactive:

```text
History Museum Kiosk   [Start]
[Open]
```
