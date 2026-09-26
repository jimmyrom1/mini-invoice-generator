#!/bin/sh
set -e

# Aplica las migraciones pendientes antes de arrancar el servidor.
flask db upgrade

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    flask seed
fi

exec "$@"
