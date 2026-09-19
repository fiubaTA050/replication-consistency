-- Intentos de envío de notificación por compra (at-least-once con máximo de intentos).
CREATE TABLE notification_attempts (
    purchase_id int PRIMARY KEY,
    attempts    int NOT NULL
);
