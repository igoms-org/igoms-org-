# Family Crest Print

A TanStack Start application for creating, printing, and publicly verifying family certificates. Supabase provides authentication and data storage; Vercel hosts the application.

## Requirements

- Node.js 22.12 or newer
- A Supabase project

## Local development

```sh
npm ci
```

Copy `.env.example` to `.env`, fill in the Supabase project URL and publishable key, then run:

```sh
npm run dev
```

Run the checks with `npm test`, `npm run lint`, and `npm run build`.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the SQL files in `drizzle/migrations` in filename order.
3. Create the administrator accounts in Supabase Authentication. The app does not provide public sign-up.
4. Add the project URL and publishable key to `.env` for local development and to the Vercel environment as described below.

For an existing database, apply `drizzle/migrations/0003_validate_certificate_data.sql` in the Supabase SQL Editor to enable certificate validation for direct RPC calls. This migration rejects malformed data before charging tokens. Public verification remains available without login through each certificate's verification link or QR code.

## Vercel deployment

1. Import this project into Vercel and leave the build command as `npm run build`.
2. Add these environment variables for the Production, Preview, and Development environments:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable key
   - `SUPABASE_URL` — the same project URL (used by server-side requests)
   - `SUPABASE_PUBLISHABLE_KEY` — the same publishable key (used by server-side requests)
3. Deploy. The Vite configuration builds the server for Vercel.
4. In Supabase Authentication settings, set the site URL and allowed redirect URLs to your Vercel domain.

`DATABASE_URL` is only needed when running Drizzle migration tools directly. Never put a Supabase secret or service-role key in a `VITE_` variable.
