# Use generic Nginx
FROM nginx:alpine

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files to the Nginx html folder
# (Note: In dev, we will override this with a volume map)
COPY . /usr/share/nginx/html