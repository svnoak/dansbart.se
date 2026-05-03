#!/bin/sh
set -e

cat > /usr/share/nginx/html/env.js <<EOF
window.__ENV__ = {
  FARO_COLLECTOR_URL: "${FARO_COLLECTOR_URL:-}",
  FARO_APP_NAME: "${FARO_APP_NAME:-dansbart-frontend}"
};
EOF

exec "$@"
