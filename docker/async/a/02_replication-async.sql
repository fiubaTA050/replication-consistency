-- Slot usado por wal-reader (branch 4-wal-reader).
SELECT pg_create_logical_replication_slot('node_wal_reader', 'pgoutput');

-- Async: A no espera a ninguna réplica.
ALTER SYSTEM SET synchronous_standby_names = '';
SELECT pg_reload_conf();
