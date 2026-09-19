# Replicación y consistencia en sistemas distribuidos

Dependencias y secuencia completa de la clase: [`main`](https://github.com/fiubaTA050/replication-consistency/tree/main).

## Parte 3: compras

Servicio `purchases/`: API + UI en `http://localhost:3000` y un tunnel público (cloudflare) para que más personas
puedan acceder al container. Es un tunnel temporal y gratuito de Cloudflare; en clase no funcionó porque estábamos
conectados por 4G y Cloudflare devolvía error.

Comandos comunes (desde `purchases/`):

```bash
# URL pública del tunnel
docker compose logs tunnel | grep trycloudflare

# logs del server
docker compose logs -f app

# psql
docker exec -it purchases-postgres-1 psql -U postgres -d appdb
```

Stock vs compras (`stock + compras` debería ser el stock inicial de `initdb/02_products.sql`):

```sql
SELECT p.id, p.name, p.stock, count(c.id) AS compras
FROM products p LEFT JOIN purchases c ON c.product_id = p.id
GROUP BY p.id ORDER BY p.id;
```

### Branch `1-basic-service`: sin transaction

`createPurchase` descuenta stock y después inserta la compra, sin transaction. Entre los dos writes hay un
`failRandomly()` (50%).

```bash
git checkout 1-basic-service
cd purchases
npm install
docker compose up -d
```

1. Comprar varias veces desde la UI.
2. Cuando falla, el stock bajó pero la compra no existe (ver la query de stock vs compras).

```bash
docker compose down -v
cd ..
```

**Siguiente:** [`2-basic-service-tx`](https://github.com/fiubaTA050/replication-consistency/tree/2-basic-service-tx)

---

Branches que usamos originalmente en clase: [`notifyier`](https://github.com/fiubaTA050/replication-consistency/tree/notifyier),
[`idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/idempotencia) y [`buena-idempotencia`](https://github.com/fiubaTA050/replication-consistency/tree/buena-idempotencia).
