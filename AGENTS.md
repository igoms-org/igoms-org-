## Application structure
- Render certificates with one shared data-driven document component fed by `toDocument()` from saved form data, so the form preview, success, and public verify pages print identically.
- All balance, cost, and certificate writes go through SECURITY DEFINER RPCs guarded by `is_admin()`/auth.uid(); clients only SELECT under RLS, so tokens cannot be forged.
- Roles live in `user_roles` (never on profiles) and are assigned only from the database, preventing self-promotion.
- Public verification reads one certificate by its unguessable public_id via RPC; no listing is exposed.
- Use A4 portrait print rules that hide app UI (`.no-print`) and preserve certificate colors.

-
