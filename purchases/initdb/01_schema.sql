CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  text NOT NULL,
    price int  NOT NULL,
    stock int  NOT NULL
);

CREATE TABLE purchases (
    id              SERIAL PRIMARY KEY,
    user_id         text        NOT NULL,
    product_id      int         NOT NULL REFERENCES products (id),
    comment         text,
    idempotency_key text,
    purchased_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT purchases_idempotency_key_uniq UNIQUE (user_id, idempotency_key)
);

CREATE INDEX purchases_user_id_idx ON purchases (user_id);
