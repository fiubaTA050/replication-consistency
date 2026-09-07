import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {closePool, createPurchase, listProducts, listPurchases} from './shop.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    try {
        if (req.method === 'GET' && url.pathname === '/api/products') {
            return sendJson(res, 200, await listProducts());
        }
        if (req.method === 'GET' && url.pathname === '/api/purchases') {
            return await getPurchases(res, url.searchParams.get('userId'));
        }
        if (req.method === 'POST' && url.pathname === '/api/purchases') {
            return await postPurchase(res, await readJson(req), req.headers['idempotency-key']);
        }
        if (req.method === 'GET') {
            return await serveStatic(res, url.pathname);
        }
        sendJson(res, 405, {error: 'method not allowed'});
    } catch (error) {
        console.error(`${req.method} ${url.pathname} failed`, error);
        sendJson(res, 500, {error: 'internal error'});
    }
});

async function getPurchases(res, userId) {
    if (!userId) {
        return sendJson(res, 400, {error: 'userId is required'});
    }
    sendJson(res, 200, await listPurchases(userId));
}

async function postPurchase(res, body, idempotencyKey) {
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const productId = Number(body?.productId);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
    console.log(`POST /api/purchases user=${userId} product=${productId} idempotencyKey=${idempotencyKey ?? '(none)'}`);

    if (!userId || !Number.isInteger(productId)) {
        return sendJson(res, 400, {error: 'invalid request'});
    }
    try {
        const purchased = await createPurchase({userId, productId, comment, idempotencyKey});
        return purchased
            ? res.writeHead(201).end()
            : sendJson(res, 409, {error: 'product unavailable'});
    } catch (error) {
        console.error(`POST /api/purchases failed code=${error.code ?? '-'}`, error.message);
        sendJson(res, 500, {error: 'purchase failed'});
    }
}

async function serveStatic(res, pathname) {
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.join(PUBLIC_DIR, relative);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
        return sendJson(res, 404, {error: 'not found'});
    }
    try {
        const content = await fs.readFile(file);
        res.writeHead(200, {'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream'});
        res.end(content);
    } catch {
        sendJson(res, 404, {error: 'not found'});
    }
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 10_000) {
                reject(new Error('payload too large'));
                req.destroy();
            }
        });
        req.on('error', reject);
        req.on('end', () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch {
                resolve(null);
            }
        });
    });
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
    });
    res.end(body);
}

server.listen(3000, '0.0.0.0', () => {
    console.log(`purchases listening on http://0.0.0.0:${3000}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        server.close(() => closePool().then(() => process.exit(0)));
    });
}
