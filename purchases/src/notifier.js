import pg from 'pg';
import {LogicalReplicationService, PgoutputPlugin} from 'pg-logical-replication';

const connection = {
    host: 'postgres',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'appdb',
};
const pool = new pg.Pool(connection);

const service = new LogicalReplicationService(connection, {
    acknowledge: {auto: false, timeoutSeconds: 0},
    flowControl: {enabled: false},
});
const plugin = new PgoutputPlugin({
    protoVersion: 2,
    publicationNames: ['purchases_pub'],
});

let processed = 0;

service.on('data', async (lsn, event) => {
    try {
        await handle(lsn, event);
    } catch (error) {
        crash(error);
    }
});

async function handle(lsn, event) {
    if (event.tag === 'insert') {
        await notify(event.new);
        processed++;
    }
    // "por eficiencia" solo confirmamos cada 10 compras (en el commit de la transaction)
    if (event.tag === 'commit' && processed % 10 === 0) {
        await service.acknowledge(lsn);
        console.log(`ACK ${lsn} after ${processed} purchases`);
    }
}

async function notify(purchase) {
    console.log(`purchase=${purchase.id} processing`);
    const product = await getProduct(purchase.product_id);
    const detail = purchase.comment ? ` - ${purchase.comment}` : '';
    const response = await fetch('https://ntfy.sh/ta050', {
        method: 'POST',
        headers: {Title: 'Nueva compra', Tags: 'shopping_cart'},
        body: `${purchase.user_id} compro ${product.name} ($${product.price})${detail}`,
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
        throw new Error(`ntfy respondio ${response.status}`);
    }
    console.log(`purchase=${purchase.id} notified`);
}

async function getProduct(productId) {
    const {rows} = await pool.query(
        'SELECT id, name, price FROM products WHERE id = $1',
        [productId],
    );
    return rows[0];
}

function crash(error) {
    console.error('notifier failed', error.message);
    process.exit(1);
}

service.on('error', crash);
service.subscribe(plugin, 'purchases_notifier').catch(crash);

// ===================================================
// ================== CLOSE ON KILL ==================
// ===================================================

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
    console.log('Stopping subscription');
    await service.stop();
    process.exit(0);
}
