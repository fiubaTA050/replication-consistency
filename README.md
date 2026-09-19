# Replicación y consistencia en sistemas distribuidos

## Dependencias

- Docker with Compose v2
- Node.js 24

## Secuencia de la clase

| Parte | Branch | Tema |
| --- | --- | --- |
| 1. Replicación asíncrona | `main` | `docker/async` |
| 2. Replicación síncrona | `main` | `docker/sync` |
| 3. Compras | `1-basic-service` | sin transaction: inconsistencias |
|  | `2-basic-service-tx` | transaction + retries en el frontend |
|  | `3-basic-service-notifications` | I/O dentro de la transaction (dual write) |
|  | `4-wal-reader` | WAL reader y ACK del LSN |
|  | `5-basic-service-with-wal-reader` | notifier como consumer del WAL |
| 4. Idempotencia | `6-basic-service-idempotency` | idempotency key en memoria |
|  | `7-basic-service-better-idempotency` | idempotency key en la base |
|  | `8-notification-delivery-semantics` | at-most-once vs at-least-once |
|  | `9-wal-consumer-order` | consumir el WAL en orden |

Cada branch agrega su sección a este README.

## Parte 1: replicación asíncrona

- Postgres A (primary): port `5432`
- Postgres B (replica, logical replication): port `5433`

```bash
cd docker/async
docker compose up -d
```

Dos terminales:

```bash
# A
docker exec -it postgres-a psql -U postgres -d appdb
```

```bash
# B
docker exec -it postgres-b psql -U postgres -d appdb
```

En B dejamos corriendo:

```sql
SELECT * FROM items ORDER BY id
\watch 1
```

### 1.1 B muerto, A sigue escribiendo

```bash
docker rm -f postgres-b
```

En A (responde sin esperar a B):

```sql
INSERT INTO items(name) VALUES ('mientras B está muerto');
```

```bash
docker compose up -d postgres-b
```

B recibe los cambios pendientes (volver a abrir el `psql` de B).

### 1.2 A muere con cambios que B no recibió

En A:

```sql
INSERT INTO items(name) VALUES ('B lo recibe');
```

```bash
docker rm -f postgres-b
```

En A:

```sql
INSERT INTO items(name) VALUES ('B no lo recibe');
UPDATE items SET name = 'actualizado' WHERE id = 1;
```

```bash
docker rm -f postgres-a
docker compose up -d postgres-b
```

B no tiene los últimos cambios: están solo en el disco de A.

```bash
# B intenta reconectarse a A
docker logs -f postgres-b
```

```bash
docker compose up -d postgres-a
```

A los ~5s B se reconecta y recibe los cambios.

### 1.3 Notas del docker compose

- `docker rm -f` mata el proceso (SIGKILL) sin graceful shutdown. Los volúmenes quedan, así que al volver a
  prenderlo recupera los datos confirmados.
- B no tiene `depends_on` sobre A: con `depends_on`, `docker compose up -d postgres-b` también prende A y no
  se pueden manejar por separado (el problema que encontramos en clase mientras probábamos).
- Sin `depends_on`, la primera vez que B arranca `b/00_wait-for-a.sh` espera a que A acepte conexiones antes
  del `CREATE SUBSCRIPTION`. Después de eso B se reconecta solo cuando A vuelve.

### Conclusión

- A no depende de B: mejor disponibilidad y menor latencia de escritura en A.
- B es eventualmente consistente.
- Si A muere antes de replicar y no se recupera, esos datos se pierden.

```bash
docker compose down -v
cd ../..
```

**Siguiente:** [Parte 2: replicación síncrona](#parte-2-replicación-síncrona)

## Parte 2: replicación síncrona

A espera que B confirme cada `COMMIT` (`synchronous_standby_names = 'FIRST 1 (items_sub)'`).

```bash
cd docker/sync
docker compose up -d
```

Mismas terminales de A y B que en la parte 1 (con `\watch 1` en B).

### 2.1 Los datos se replican

En A:

```sql
INSERT INTO items(name) VALUES ('uno');
SELECT application_name, sync_state FROM pg_stat_replication;
```

### 2.2 B muerto: A se bloquea

```bash
docker rm -f postgres-b
```

En A (queda bloqueado):

```sql
INSERT INTO items(name) VALUES ('esperando a B');
```

En otra terminal:

```bash
docker exec -it postgres-a psql -U postgres -d appdb -c "SELECT pid, wait_event, query FROM pg_stat_activity WHERE wait_event = 'SyncRep'"
```

### 2.3 B vuelve: A se destraba

```bash
docker compose up -d postgres-b
```

El `INSERT` bloqueado termina y B tiene el dato.

> Si se cancela el `INSERT` bloqueado (Ctrl+C), la transaction ya quedó confirmada localmente en A: Postgres
> solo avisa con un `WARNING`. Desde ese momento el dato se puede consultar en A aunque B no lo tenga (lo recibe
> cuando vuelve). Mientras el `INSERT` espera a B, las demás sesiones no lo ven.

### Conclusión

- Toda transaction cuyo `COMMIT` fue confirmado al cliente está en A y en B: si A se pierde, B tiene esos datos.
- La disponibilidad de escritura en A depende de B (es más baja).
- La latencia de escritura en A es más alta: cada `COMMIT` espera a B.
- Limitación implícita de Postgres: para replicar, A primero tiene que confirmar el `COMMIT` en su WAL, así que
  siempre hay un momento en que A tiene el dato y B no. Si en ese momento se cancela la espera o A se cae, A queda
  con datos que B no tiene. Sin otras herramientas (ej: consenso entre 3 o más nodos, como Raft) no se puede
  prometer al 100% que B tenga todo lo que tiene A.

```bash
docker compose down -v
cd ../..
```

**Siguiente:** [`1-basic-service`](https://github.com/fiubaTA050/replication-consistency/tree/1-basic-service)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
