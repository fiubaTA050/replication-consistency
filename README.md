# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 4: idempotencia

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `6-basic-service-idempotency`: idempotency key en memoria

- `failRandomly()` ahora está después del `COMMIT`: la compra queda confirmada pero el cliente recibe `500` y
  reintenta.
- La UI genera un `Idempotency-Key` por compra y lo repite en cada reintento.
- El server guarda las keys en un `Set` en memoria: si la key ya está, responde OK sin volver a comprar.

```bash
git checkout 6-basic-service-idempotency
cd purchases
docker compose up -d
docker compose logs -f app notifier
```

1. Sin key, los retries duplican compras (y notificaciones). Reintentar hasta `201`:

```bash
until curl -sf -X POST localhost:3000/api/purchases -H 'content-type: application/json' -d '{"userId":"sin-key","productId":1}'; do echo retry; done
```

2. Con key, los retries no duplican:

```bash
KEY=$(uuidgen)
until curl -sf -X POST localhost:3000/api/purchases -H 'content-type: application/json' -H "Idempotency-Key: $KEY" -d '{"userId":"con-key","productId":2}'; do echo retry; done
```

```sql
SELECT user_id, count(*) FROM purchases GROUP BY user_id;
```

3. Desde la UI: la key se muestra en el diálogo y se mantiene en todos los intentos.

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`7-basic-service-better-idempotency`](https://github.com/fiubaTA050/replication-consistency/tree/7-basic-service-better-idempotency)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
