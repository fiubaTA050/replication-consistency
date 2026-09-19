# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 4: idempotencia

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `7-basic-service-better-idempotency`: idempotency key en la base

#### 1. El `Set` en memoria no alcanza

Todavía en `6-basic-service-idempotency`, comprar con una key, reiniciar el server y reintentar con la misma key:

```bash
git checkout 6-basic-service-idempotency
cd purchases
docker compose up -d
KEY=$(uuidgen)
until curl -sf -X POST localhost:3000/api/purchases -H 'content-type: application/json' -H "Idempotency-Key: $KEY" -d '{"userId":"restart","productId":2}'; do echo retry; done
docker compose restart app
curl -s -w "%{http_code}\n" -X POST localhost:3000/api/purchases -H 'content-type: application/json' -H "Idempotency-Key: $KEY" -d '{"userId":"restart","productId":2}'
```

La compra se duplica:

- `COMMIT` y `Set.add` son dos writes no atómicos (dual write): si el proceso muere entre los dos, se pierde la key.
- Dos requests concurrentes con la misma key pasan los dos el `has()` antes del `add()`.
- Cada réplica del server tiene su propio `Set`.

```bash
docker compose down -v
cd ..
```

#### 2. Key en la misma transaction que la compra

`purchases` tiene `idempotency_key` con `UNIQUE (user_id, idempotency_key)`. Si el `INSERT` falla por ese
constraint, la compra ya existe: respondemos OK.

```bash
git checkout 7-basic-service-better-idempotency
cd purchases
docker compose up -d
```

Repetir los comandos de `curl` del punto 1 (con restart incluido): una sola compra.

```sql
SELECT user_id, idempotency_key, count(*) FROM purchases GROUP BY 1, 2;
```

```bash
docker compose down -v
cd ..
```

#### Notas (no implementadas)

- La key debería validar también el payload: si llega la misma key con otros productos, responder error en vez de OK.
- Guardar keys para siempre no escala: limitarlas por cantidad o por tiempo (TTL).
- Hay operaciones idempotentes sin key: `DELETE` (borrar algo muchas veces termina siempre en el mismo resultado),
  o crear una entidad cuyo id único define el cliente, porque el servidor puede hacer un upsert por ese id (como
  Firebase, donde si no se elige un id el cliente genera uno random). Si el servicio solo llama a otro servicio
  idempotente, no necesita persistir la key: le reenvía la key (o una derivada de forma determinística, ej: key +
  userId; nunca random ni con el reloj).

**Siguiente:** [`8-notification-delivery-semantics`](https://github.com/fiubaTA050/replication-consistency/tree/8-notification-delivery-semantics)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
