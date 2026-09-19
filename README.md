# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 4: idempotencia

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `9-wal-consumer-order`: consumir el WAL en orden

`service.on('data', async (...) => { await ... })` no procesa en orden: el `EventEmitter` no espera la `Promise`
del handler, así que cada evento nuevo del WAL arranca en paralelo con los anteriores.

#### 1. El problema

Todavía en `8-notification-delivery-semantics`:

```bash
git checkout 8-notification-delivery-semantics
cd purchases
docker compose up -d
docker compose logs -f notifier
```

5 compras seguidas:

```bash
for i in $(seq 1 5); do curl -s -o /dev/null -X POST localhost:3000/api/purchases -H 'content-type: application/json' -H "Idempotency-Key: $(uuidgen)" -d "{\"userId\":\"orden\",\"productId\":$i}"; done
```

En los logs, todos los `processing` aparecen antes que los `notified`, y los `notified` salen desordenados.
Además, el ACK de un `COMMIT` puede llegar antes de que terminen eventos anteriores: si el proceso muere, esos
eventos se pierden (ya no es at-least-once).

```bash
docker compose down -v
cd ..
```

#### 2. La solución

Podemos usar la feature de la librería (`pg-logical-replication`) que permite procesar en orden, configurando
`flowControl: {enabled: true}`. Con eso espera la `Promise` del listener (el mismo `async`/`await` de antes) y no
consume ningún otro evento hasta que termine, aunque esté esperando mucho tiempo la respuesta de la API.

Por eso todo I/O (base de datos o sistema externo) tiene que tener timeout (ej: `AbortSignal.timeout(5000)` en
el `fetch` a ntfy): si no, una respuesta que nunca llega deja al consumer bloqueado para siempre, sin errores.

```bash
git checkout 9-wal-consumer-order
cd purchases
docker compose up -d
docker compose logs -f notifier
```

Repetir las 5 compras: `processing` y `notified` alternan, en el orden del WAL.

```bash
docker compose down -v
cd ..
```

#### ¿Por qué importa el orden?

Si en vez de notificar replicamos datos, procesar en paralelo puede dejar la copia inconsistente. Ejemplo con el
stock de un producto: el WAL tiene `stock = 5` y después `stock = 4`. Si los dos eventos se aplican en paralelo y
el primero termina último, la copia queda en `stock = 5` para siempre, aunque el stock real sea 4.

#### Nota extra: orden de las transactions en Postgres

Detalle de implementación de Postgres, no hace falta para la materia. El WAL intercala los cambios de
transactions concurrentes, pero el logical decoding los agrupa y envía cada transaction completa, en orden de
`COMMIT` (no de inicio). Las que hacen `ROLLBACK` no se envían:

```
WAL:      T1 BEGIN, T2 BEGIN, T2 INSERT a, T1 INSERT b, T2 COMMIT, T1 COMMIT
consumer: T2 (INSERT a), T1 (INSERT b)
```

Excepción: con `streaming = on`, las transactions grandes se envían por partes antes del `COMMIT` y sí pueden
llegar intercaladas (el notifier no lo activa).

No cambiamos nada por esto: lo que nos interesa es el concepto general de CDC, no los detalles de Postgres.
Por estos detalles sutiles es poco común escribir un WAL consumer a mano en vez de usar una herramienta madura
(ej: Debezium).

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
