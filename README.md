# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 3: compras

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `2-basic-service-tx`: transaction + retries

Los dos writes van en una transaction: si `failRandomly()` falla, `ROLLBACK` y la API responde `500`.
La UI reintenta hasta 3 veces (y "Comprar de nuevo" vuelve a intentar).

```bash
git checkout 2-basic-service-tx
cd purchases
docker compose up -d
```

1. Comprar varias veces: en el diálogo se ven los intentos fallidos y los reintentos.
2. Stock y compras siempre coinciden (query de stock vs compras).

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`3-basic-service-notifications`](https://github.com/fiubaTA050/replication-consistency/tree/3-basic-service-notifications)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
