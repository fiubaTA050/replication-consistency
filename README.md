# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 4: idempotencia

Comandos comunes (tunnel, logs, psql, query de stock vs compras):
[`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service#parte-3-compras).

### Branch `8-notification-delivery-semantics`: at-most-once vs at-least-once

El notifier ahora tiene un `failRandomly()` (30%) después de enviar la notificación y antes del ACK: el proceso
muere, docker lo reinicia (`restart: unless-stopped`) y postgres reenvía todo desde el último ACK.

ntfy no es idempotente: no hay forma de enviar exactamente una vez. Solo podemos elegir:

- at-most-once: ACK antes de enviar. Si falla, la notificación se pierde.
- at-least-once: enviar y después ACK. Si falla, la notificación se duplica.

Implementamos at-least-once con un máximo de 3 envíos por compra: el intento se registra en
`notification_attempts` (`initdb/04_notification_attempts.sql`, PK = id de la compra) antes de enviar.

```bash
git checkout 8-notification-delivery-semantics
cd purchases
docker compose up -d
docker compose logs -f notifier
```

1. Comprar desde la UI: en ntfy llegan notificaciones duplicadas y en los logs se ven los crashes y los
   `skipped: 3 attempts reached`.
2. Intentos por compra:

```sql
SELECT * FROM notification_attempts;
```

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`9-wal-consumer-order`](https://github.com/fiubaTA050/replication-consistency/tree/9-wal-consumer-order)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
