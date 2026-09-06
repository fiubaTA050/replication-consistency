import {LogicalReplicationService, PgoutputPlugin} from 'pg-logical-replication';
import readline from 'node:readline';

const clientConfig = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'appdb',
};
const service = new LogicalReplicationService(clientConfig, {
    acknowledge: {auto: false, timeoutSeconds: 0},
    flowControl: {enabled: false},
});
const plugin = new PgoutputPlugin({
    protoVersion: 2,
    publicationNames: ['items_pub'],
});

let lastLSN = null;

service.on('data', (lsn, event) => {
    if (event.tag !== 'relation') {
        console.log(`${event.tag.toUpperCase()} >>>>>>>>>>>`);
        console.log(formatMessage(event, lsn));
    } else {
        console.log(`IGNORING "${event.tag}" >>>>>>>>>>>`)
    }
    lastLSN = lsn;
});

service.on('error', (error) => {
    console.error('Subscription error', error);
    process.exit(1);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.on('line', async () => {
    await service.acknowledge(lastLSN);
    console.log(`ACK ${lastLSN}`)
    rl.prompt();
});

console.log(`Streaming WAL: press enter to confirm last LSN`);
service.subscribe(plugin, 'node_wal_reader')
    .catch(err => {
        console.error('Fatal error starting replication:', err);
        return shutdown();
    });

// ===================================================
// ================== CLOSE ON KILL ==================
// ===================================================

rl.on('SIGINT', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
    // avoid error: replication slot "node_wal_reader" is active for PID NNNNN
    console.log(`Stopping subscription`);
    rl.close();
    await service.stop();
    process.exit(0);
}

// ================================================
// ================== FORMATTING ==================
// ================================================

function formatMessage(event, lsn) {
    // ignore a bunch of fields to simplify output
    const {
        xid,
        key,
        relation,
        flags,
        columns,
        replicaIdentity,
        name,
        schema,
        relationOid,
        tag,
        commitEndLsn,
        ...message
    } = event;
    return {
        lsn,
        ...message,
        ...formatHack(message, 'old'),
        ...formatHack(message, 'new'),
        ...formatHack(message, 'commitTime', v => new Date(Number(message.commitTime / 1000n)).toISOString()),
    };
}

function formatHack(message, key, fValue) {
    if (message[key]) {
        return {[key]: JSON.parse(JSON.stringify(fValue ? fValue(message[key]) : message[key]))};
    } else {
        return {};
    }
}
