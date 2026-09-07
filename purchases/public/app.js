const MAX_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

const userIdInput = document.getElementById('userId');
const commentInput = document.getElementById('comment');
const commentDialog = document.getElementById('comment-dialog');
const dialogProduct = document.getElementById('dialog-product');
const commentForm = document.getElementById('comment-form');
const productsList = document.getElementById('products');
const purchasesList = document.getElementById('purchases');
const productsStatus = document.getElementById('products-status');
const purchasesStatus = document.getElementById('purchases-status');
const refreshButton = document.getElementById('refresh');
const toast = document.getElementById('toast');
const pendingPanel = document.getElementById('pending');
const pendingProduct = document.getElementById('pending-product');
const pendingKey = document.getElementById('pending-key');
const attemptsList = document.getElementById('attempts');
const retryButton = document.getElementById('retry');
const cancelButton = document.getElementById('cancel');

let pending = null;
let toastTimer = null;

userIdInput.value = localStorage.getItem('userId') ?? '';

userIdInput.addEventListener('input', () => {
    localStorage.setItem('userId', userIdInput.value);
    loadPurchases();
});

refreshButton.addEventListener('click', loadPurchases);
retryButton.addEventListener('click', () => send());
cancelButton.addEventListener('click', clearPending);

function newKey() {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, 2500);
}

function formatPrice(price) {
    return `$${price.toLocaleString('es-AR')}`;
}

function count(total, singular, plural) {
    return `${total} ${total === 1 ? singular : plural}`;
}

function logAttempt(message) {
    const entry = document.createElement('li');
    entry.textContent = `${new Date().toLocaleTimeString('es-AR')} · ${message}`;
    attemptsList.append(entry);
}

function clearPending() {
    pending = null;
    pendingPanel.hidden = true;
    attemptsList.replaceChildren();
}

async function request(path, options) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error ?? `falló la petición (${response.status})`);
    }
    return payload;
}

async function loadProducts() {
    productsStatus.textContent = 'Cargando…';
    try {
        const products = await request('/api/products');
        productsList.replaceChildren(...products.map(renderProduct));
        productsStatus.textContent = count(products.length, 'producto', 'productos');
    } catch (error) {
        productsStatus.textContent = error.message;
    }
}

function renderProduct(product) {
    const item = document.createElement('li');

    const label = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = product.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${formatPrice(product.price)} · ${count(product.stock, 'unidad', 'unidades')}`;
    label.append(name, meta);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Comprar';
    button.disabled = product.stock <= 0;
    button.addEventListener('click', () => buy(product));

    item.append(label, button);
    return item;
}

function askComment(product) {
    dialogProduct.textContent = product.name;
    commentInput.value = '';
    commentDialog.showModal();
    return new Promise((resolve) => {
        commentForm.onsubmit = (event) => resolve(event.submitter.value === 'ok' ? commentInput.value.trim() : null);
        commentDialog.oncancel = () => resolve(null);
    });
}

async function buy(product) {
    const userId = userIdInput.value.trim();
    if (!userId) {
        userIdInput.focus();
        showToast('Escribí tu nombre de usuario');
        return;
    }
    const comment = await askComment(product);
    if (comment === null) {
        return;
    }
    pending = {
        userId,
        productId: product.id,
        productName: product.name,
        comment,
        key: newKey(),
    };
    pendingProduct.textContent = product.name;
    pendingKey.textContent = pending.key;
    attemptsList.replaceChildren();
    pendingPanel.hidden = false;
    send();
}

async function send() {
    if (!pending) {
        return;
    }
    retryButton.disabled = true;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        logAttempt(`Intento ${attempt} de ${MAX_ATTEMPTS}…`);
        try {
            await request('/api/purchases', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'Idempotency-Key': pending.key,
                },
                body: JSON.stringify({
                    userId: pending.userId,
                    productId: pending.productId,
                    comment: pending.comment,
                }),
            });
            logAttempt(`Intento ${attempt}: compra registrada`);
            showToast(`Compraste ${pending.productName}`);
            pending = null;
            retryButton.disabled = true;
            await Promise.all([loadProducts(), loadPurchases()]);
            return;
        } catch (error) {
            logAttempt(`Intento ${attempt}: ${error.message}`);
            if (attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_DELAY);
            }
        }
    }
    logAttempt(`Se agotaron los ${MAX_ATTEMPTS} intentos`);
    showToast('No se pudo completar la compra');
    retryButton.disabled = false;
    await Promise.all([loadProducts(), loadPurchases()]);
}

async function loadPurchases() {
    const userId = userIdInput.value.trim();
    if (!userId) {
        purchasesList.replaceChildren();
        purchasesStatus.textContent = 'Escribí un usuario para ver sus compras';
        return;
    }
    purchasesStatus.textContent = 'Cargando…';
    try {
        const purchases = await request(`/api/purchases?userId=${encodeURIComponent(userId)}`);
        purchasesList.replaceChildren(...purchases.map(renderPurchase));
        purchasesStatus.textContent = purchases.length
            ? count(purchases.length, 'compra', 'compras')
            : 'Todavía no hay compras';
    } catch (error) {
        purchasesStatus.textContent = error.message;
    }
}

function renderPurchase(purchase) {
    const item = document.createElement('li');

    const label = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = purchase.productName;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${formatPrice(purchase.productPrice)} · ${new Date(purchase.purchasedAt).toLocaleString('es-AR')}`;
    label.append(name, meta);

    if (purchase.comment) {
        const comment = document.createElement('span');
        comment.className = 'comment';
        comment.textContent = purchase.comment;
        label.append(comment);
    }

    item.append(label);
    return item;
}

loadProducts();
loadPurchases();
