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

export async function createPurchase({userId, productId, comment}) {
    const client = await pool.connect();
    try {
        const {rows: products} = await client.query(
            'SELECT id, name, price, stock FROM products WHERE id = $1',
            [productId],
        );
        if (products.length === 0 || products[0].stock <= 0) {
            return false;
        }

        await client.query(
            'UPDATE products SET stock = stock - 1 WHERE id = $1',
            [productId],
        );

        failRandomly();

        await client.query(
            'INSERT INTO purchases (user_id, product_id, comment) VALUES ($1, $2, $3)',
            [userId, productId, comment || null],
        );

        return true;
    } finally {
        client.release();
    }
}

function failRandomly() {
    if (Math.random() < 0.5) {
        throw new Error('random failure');
    }
}

export function closePool() {
    return pool.end();
}
