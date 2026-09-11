import pg from 'pg';

const seenIdempotencyKeys = new Set();

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
    if (seenIdempotencyKeys.has(idempotencyKey)) {
        console.log(`purchase replayed idempotencyKey=${idempotencyKey}`);
        return true;
    }

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
            'INSERT INTO purchases (user_id, product_id, comment) VALUES ($1, $2, $3)',
            [userId, productId, comment || null],
        );

        failRandomly();

        await client.query('COMMIT');
        if (idempotencyKey) {
            seenIdempotencyKeys.add(idempotencyKey);
        }
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

function failRandomly() {
    if (Math.random() < 0.7) {
        throw new Error('random failure');
    }
}

export function closePool() {
    return pool.end();
}
