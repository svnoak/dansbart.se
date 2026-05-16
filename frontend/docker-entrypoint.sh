#!/bin/sh
set -e

cat > /usr/share/nginx/html/env.js <<EOF
window.__ENV__ = {
  FARO_COLLECTOR_URL: "${FARO_COLLECTOR_URL:-}",
  FARO_APP_NAME: "${FARO_APP_NAME:-dansbart-frontend}"
};
EOF

envsubst '${FARO_COLLECTOR_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
