# Replicación y consistencia en sistemas distribuidos

## Dependencias

- Docker with Compose v2
- Node.js 24

## Postgres Replication

Docker compose:

- Postgres A (primary): port `5432`
- Postgres B (replica): port `5433`

```bash
# start all containers
docker compose up

# stop a container without deleting the data
docker rm -f postgres-b

# repair all containers (restart the killed containers)
docker compose up -d

# stop all containers and remove data
docker compose down -v --remove-orphans
```

### Interactive queries

```bash
# primary
docker exec -ti postgres-a psql -U postgres -d appdb
# replica
docker exec -ti postgres-b psql -U postgres -d appdb
```

#### Data queries

```sql
INSERT INTO items(name) VALUES ('some name');
```

```sql
UPDATE items SET name = 'new name' WHERE id = 1;
```

#### Watch items

```sql
SELECT * FROM items
\watch 1
```

## Server

```
cd purchases
# start the server
docker compose up -d

# restart the app after some code changes
docker compose restart app

# kill the server and data
docker compose down -v --remove-orphans

# query the db
docker exec -it purchases-postgres psql -U postgres -d appdb
```

> El esquema vive en `purchases/initdb/`, que solo corre cuando el volumen esta vacio.
> Despues de cambiarlo hay que recrear la base: `docker compose down -v --remove-orphans && docker compose up -d`.

### Idempotencia

El cliente manda un `Idempotency-Key` por compra y reintenta hasta 3 veces.
La clave se guarda en la misma fila de `purchases`, protegida por
`UNIQUE (user_id, idempotency_key)`, y se escribe dentro de la misma transaccion
que descuenta el stock:

- si la transaccion falla (`failRandomly`, ntfy caido, error de serializacion) el
  rollback se lleva la clave, asi que el reintento vuelve a intentar la compra;
- si la transaccion commitea, el reintento choca contra el `UNIQUE`, el
  `ON CONFLICT DO NOTHING` no inserta nada y el servidor responde 201 sin volver
  a descontar stock ni a notificar.

Marcar la clave en memoria (un `Set` en el proceso) seria una escritura doble:
dos almacenamientos que pueden divergir. Si el proceso commitea y muere antes de
marcar el `Set` el reintento duplica la compra; si marca el `Set` y el commit
falla, la compra se pierde para siempre. Ademas cada replica del servidor tiene
su propio `Set`, asi que basta con que el reintento caiga en otra instancia para
que la deduplicacion no exista. Con la clave en la base, el efecto y su marca de
deduplicacion son la misma escritura atomica.

La llamada a ntfy sigue siendo una escritura doble: se manda antes del `COMMIT`,
asi que puede notificarse una compra que despues no queda registrada.

## WAL reader

`wal-reader/` opens a logical replication connection to **postgres A**, prints
every decoded WAL record to stdout, and **acknowledges only when you tell it to** from stdin.

If the consumer takes more than `wal_sender_timeout` to acknowledge the LSN (or send a heartbeat),
the Postgres server will kill the connection (`terminating walsender process due to replication timeout`).
