import pg from 'pg';

const pool = new pg.Pool({
    host: 'postgres',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'appdb',
});

export async function listProducts() {
    const {rows} = await pool.query(
        'SELECT id, name, price, stock FROM products ORDER BY id',
    );
    return rows;
}

export async function listPurchases(userId) {
    const {rows} = await pool.query(
        `SELECT p.id,
                p.user_id      AS "userId",
                p.product_id   AS "productId",
                pr.name        AS "productName",
                pr.price       AS "productPrice",
                p.comment,
                p.purchased_at AS "purchasedAt"
         FROM purchases p
                  JOIN products pr ON pr.id = p.product_id
         WHERE p.user_id = $1
         ORDER BY p.purchased_at DESC, p.id DESC`,
        [userId],
    );
    return rows;
}

export async function createPurchase({userId, productId, comment, idempotencyKey}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        const {rows: products} = await client.query(
            'SELECT id, name, price, stock FROM products WHERE id = $1',
            [productId],
        );
        if (products.length === 0 || products[0].stock <= 0) {
            await client.query('ROLLBACK');
            return false;
        }

        await client.query(
            'UPDATE products SET stock = stock - 1 WHERE id = $1',
            [productId],
        );

        await client.query(
            'INSERT INTO purchases (user_id, product_id, comment, idempotency_key) VALUES ($1, $2, $3, $4)',
            [userId, productId, comment || null, idempotencyKey || null],
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        // la key ya existe: la compra se hizo en un intento anterior
        if (error.code === '23505' && error.constraint === 'purchases_idempotency_key_uniq') {
            console.log(`purchase replayed idempotencyKey=${idempotencyKey}`);
            return true;
        }
        throw error;
    } finally {
        client.release();
    }

    // la compra ya está confirmada, pero el cliente recibe un error y reintenta
    failRandomly();
    return true;
}

function failRandomly() {
    if (Math.random() < 0.5) {
        throw new Error('random failure');
    }
}

export function closePool() {
    return pool.end();
}
