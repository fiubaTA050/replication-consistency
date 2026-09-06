-- Replication target setup for postgres B (subscriber side).
--
-- Logical replication only ships row changes, never DDL, so the target table
-- must already exist with a matching shape before the subscription starts.
-- The seed data itself is NOT inserted here: it arrives from A through the
-- initial table copy performed by the subscription.

CREATE TABLE items (
    id   SERIAL PRIMARY KEY,
    name text NOT NULL
);

-- application_name defaults to the subscription name, which is what
-- `synchronous_standby_names` on A matches against in the sync stack.
CREATE SUBSCRIPTION items_sub
    CONNECTION 'host=postgres-a port=5432 user=postgres password=postgres dbname=appdb'
    PUBLICATION items_pub
    WITH (copy_data = true, streaming = on);
