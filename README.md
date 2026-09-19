# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 3: compras

### Branch `4-wal-reader`: leer el WAL

`wal-reader/` se conecta a postgres A (`docker/async`) por logical replication (slot `node_wal_reader`),
imprime cada cambio y hace ACK del último LSN solo cuando apretamos Enter.

```bash
git checkout 4-wal-reader
cd docker/async
docker compose up -d
cd ../../wal-reader
npm install
npm start
```

En otra terminal, psql en A:

```bash
docker exec -it async-postgres-a-1 psql -U postgres -d appdb
```

```sql
SELECT slot_name, confirmed_flush_lsn, pg_current_wal_lsn() FROM pg_replication_slots;
```

1. `INSERT`/`UPDATE`/`DELETE` en `items`: el reader los imprime, pero `confirmed_flush_lsn` no avanza.
2. Enter en el reader: `ACK <lsn>` y `confirmed_flush_lsn` avanza.
3. Más cambios, matar el reader sin ACK (Ctrl+C) y volver a correr `npm start`: recibe de nuevo todo lo
   posterior al último ACK.

Mientras no hay ACK, A retiene el WAL. Si el reader no responde en `wal_sender_timeout` (120s), A corta la
conexión (`terminating walsender process due to replication timeout`).

```bash
cd ../docker/async
docker compose down -v
cd ../..
```

**Siguiente:** [`5-basic-service-with-wal-reader`](https://github.com/fiubaTA050/replication-consistency/tree/5-basic-service-with-wal-reader)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
