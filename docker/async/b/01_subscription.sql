-- La replicación lógica no copia DDL: la tabla tiene que existir en B.
CREATE TABLE items (
    id   SERIAL PRIMARY KEY,
    name text NOT NULL
);

-- El nombre de la subscription es el application_name que A usa en synchronous_standby_names.
CREATE SUBSCRIPTION items_sub
    CONNECTION 'host=postgres-a port=5432 user=postgres password=postgres dbname=appdb'
    PUBLICATION items_pub
    WITH (copy_data = true, streaming = on);
