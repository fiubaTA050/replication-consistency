# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 3: compras

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `5-basic-service-with-wal-reader`: notifier

La API solo escribe en la base. `src/notifier.js` es un proceso aparte (service `notifier`) que consume el
WAL (publication `purchases_pub`, slot `purchases_notifier`, creados en `initdb/03_replication.sql`) y envía
una notificación por cada `INSERT` en `purchases`. Hace ACK cada 10 compras: en escenarios realistas, hacer ACK
por cada transaction es poco performante.

```bash
git checkout 5-basic-service-with-wal-reader
cd purchases
npm install
docker compose up -d
docker compose logs -f notifier
```

1. Comprar: solo se notifican las compras confirmadas (las que hicieron `ROLLBACK` nunca llegan al WAL).
2. Con menos de 10 compras desde el último ACK, matar el notifier:

```bash
docker rm -f purchases-notifier-1
docker compose up -d notifier
```

Se reenvían las notificaciones posteriores al último ACK: no se pierden, pero se duplican.

El ACK se hace con el LSN del `COMMIT`, no del `INSERT`: Postgres reenvía entera toda transaction cuyo `COMMIT`
no fue confirmado. Un ACK a mitad de una transaction equivale a confirmar el `COMMIT` de la transaction anterior,
y al reiniciar la transaction se repite completa (no llegamos a mostrarlo en clase):

```
BEGIN  INSERT tx2-a  INSERT tx2-b (ACK)  COMMIT   -> al reiniciar llega tx2 entera
BEGIN  INSERT tx2-a  INSERT tx2-b  COMMIT (ACK)   -> al reiniciar no llega nada
```

```sql
SELECT slot_name, confirmed_flush_lsn, pg_current_wal_lsn() FROM pg_replication_slots;
```

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`6-basic-service-idempotency`](https://github.com/fiubaTA050/replication-consistency/tree/6-basic-service-idempotency)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
