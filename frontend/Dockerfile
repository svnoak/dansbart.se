FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

ARG FARO_API_KEY
ARG FARO_UPLOAD_ENDPOINT
ARG FARO_APP_ID
ARG FARO_STACK_ID
ENV FARO_API_KEY=$FARO_API_KEY \
    FARO_UPLOAD_ENDPOINT=$FARO_UPLOAD_ENDPOINT \
    FARO_APP_ID=$FARO_APP_ID \
    FARO_STACK_ID=$FARO_STACK_ID

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
