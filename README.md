# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 3: compras

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `3-basic-service-notifications`: I/O dentro de la transaction

Antes del `COMMIT` se envía la notificación a ntfy y después `failRandomly()`.

```bash
git checkout 3-basic-service-notifications
cd purchases
docker compose up -d
```

Notificaciones: abrir https://ntfy.sh/ta050 (o la app de ntfy suscripta a `ta050`), o:

```bash
curl -s ntfy.sh/ta050/json
```

#### Notificación y transaction no son atómicas

- Notificación antes del `COMMIT`: si `failRandomly()` falla, llega la notificación pero la compra no existe.
  Con los retries de la UI llegan varias notificaciones por una sola compra.
- Notificación después del `COMMIT`: si el proceso falla entre el `COMMIT` y el envío, la compra existe y
  nunca se notifica.

No es consistencia eventual: el sistema queda inconsistente para siempre.

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`4-wal-reader`](https://github.com/fiubaTA050/replication-consistency/tree/4-wal-reader)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
