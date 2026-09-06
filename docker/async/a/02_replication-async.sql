SELECT pg_create_logical_replication_slot('node_wal_reader', 'pgoutput');

-- Async: no standby is synchronous.
ALTER SYSTEM SET synchronous_standby_names = '';
SELECT pg_reload_conf();
