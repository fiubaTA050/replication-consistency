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

### Push notifications (WAL consumer)

The purchase transaction only writes to postgres. `purchases/src/notifier.js` runs as a separate process
(the `notifier` compose service), streams every committed `INSERT` on `purchases` (publication `purchases_pub`,
slot `purchases_notifier`) and sends the push notification to ntfy. Rolled back purchases never reach the WAL stream,
so they are never notified.

Same strategy as the WAL reader: the LSN is acknowledged manually, but only **after every 10 purchases**.
If the notifier restarts (`docker compose restart notifier`) before the 10th purchase, postgres replays every
purchase since the last ACK and the notifications are sent again (at-least-once delivery).

```bash
# follow the notifier logs
docker compose logs -f notifier
```

Since the notifier doesn't answer keepalives, the purchases postgres runs with `wal_sender_timeout=0`.

The publication and slot are created by `initdb/03_replication.sql`: run `docker compose down -v` once so they get created.

## WAL reader

`wal-reader/` opens a logical replication connection to **postgres A**, prints
every decoded WAL record to stdout, and **acknowledges only when you tell it to** from stdin.

If the consumer takes more than `wal_sender_timeout` to acknowledge the LSN (or send a heartbeat),
the Postgres server will kill the connection (`terminating walsender process due to replication timeout`).
