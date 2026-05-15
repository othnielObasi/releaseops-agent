#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs"
HTTP_CONF="/etc/nginx/templates/http.conf"
HTTPS_CONF="/etc/nginx/templates/https.conf"
TARGET_CONF="/etc/nginx/conf.d/default.conf"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    cp "$HTTPS_CONF" "$TARGET_CONF"
else
    cp "$HTTP_CONF" "$TARGET_CONF"
fi

exec nginx -g 'daemon off;'