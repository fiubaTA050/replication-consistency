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

        const {rows: inserted} = await client.query(
            `INSERT INTO purchases (user_id, product_id, comment, idempotency_key)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT ON CONSTRAINT purchases_idempotency_key_uniq DO NOTHING
             RETURNING id`,
            [userId, productId, comment || null, idempotencyKey || null],
        );
        if (inserted.length === 0) {
            await client.query('ROLLBACK');
            console.log(`purchase replayed idempotencyKey=${idempotencyKey}`);
            return true;
        }

        await client.query(
            'UPDATE products SET stock = stock - 1 WHERE id = $1',
            [productId],
        );

        failRandomly();

        await notify(userId, products[0], comment);

        await client.query('COMMIT');
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

async function notify(userId, product, comment) {
    const detail = comment ? ` - ${comment}` : '';
    const response = await fetch('https://ntfy.sh/ta050', {
        method: 'POST',
        headers: {Title: 'Nueva compra', Tags: 'shopping_cart'},
        body: `${userId} compro ${product.name} ($${product.price})${detail}`,
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
        throw new Error(`ntfy respondio ${response.status}`);
    }
}

export function closePool() {
    return pool.end();
}
