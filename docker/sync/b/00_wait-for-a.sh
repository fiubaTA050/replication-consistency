#!/bin/sh
# Solo corre la primera vez que B arranca (volumen vacío).
# CREATE SUBSCRIPTION necesita conectarse a A: esperamos a que A acepte conexiones TCP.
# Mientras A corre sus init scripts solo escucha por socket local, así que esto también
# espera a que A tenga la publication creada.
until pg_isready -h postgres-a -p 5432 -U postgres -q; do
  echo "waiting for postgres-a..."
  sleep 1
done
