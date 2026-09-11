CREATE PUBLICATION purchases_pub FOR TABLE purchases;

SELECT pg_create_logical_replication_slot('purchases_notifier', 'pgoutput');
