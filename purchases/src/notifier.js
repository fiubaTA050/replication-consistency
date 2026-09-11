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

let sent = 0;

service.on('data', async (lsn, event) => {
    if (event.tag === 'insert') {
        await notify(event.new);
        sent++;
        if (sent % 10 === 0) {
            await service.acknowledge(lsn);
            console.log(`notifier ACK ${lsn} after ${sent} purchases`);
        }
    }
});

async function notify(purchase) {
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
    console.log(`notifier purchase=${purchase.id} notified`);
}

export async function getProduct(productId) {
    const {rows} = await pool.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1',
        [productId],
    );
    return rows[0];
}

service.subscribe(plugin, 'purchases_notifier')
    .catch(err => {
        console.error('Fatal error starting replication:', err);
        return shutdown();
    });

service.on('error', (error) => {
    console.error('Subscription error', error);
    process.exit(1);
});

// ===================================================
// ================== CLOSE ON KILL ==================
// ===================================================

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
    console.log(`Stopping subscription`);
    await service.stop();
    process.exit(0);
}