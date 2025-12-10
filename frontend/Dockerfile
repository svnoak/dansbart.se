FROM nginx:alpine

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files
COPY . /usr/share/nginx/html

# Remove unnecessary files
RUN rm -f /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/nginx.prod.conf \
          /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/.gitignore

# Set correct permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]