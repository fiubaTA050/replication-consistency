-- Sync: wait for the standby that reports itself as `items_sub`. A logical
-- replication subscriber uses its subscription name as application_name, so
-- this matches B's `CREATE SUBSCRIPTION items_sub`.
--
-- FIRST 1 (items_sub)  -> wait for that one standby
-- synchronous_commit = on -> wait for a remote *flush* (durable on B),
--                            not just a remote write into B's memory.
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (items_sub)';
ALTER SYSTEM SET synchronous_commit = 'on';
SELECT pg_reload_conf();
