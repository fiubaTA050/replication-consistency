-- Sync: cada COMMIT en A espera a que B (items_sub) confirme el flush.
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (items_sub)';
ALTER SYSTEM SET synchronous_commit = 'on';
SELECT pg_reload_conf();
