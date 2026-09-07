FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL=https://backend-live-staging-172974692065.us-central1.run.app
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build -- --mode staging

FROM nginx:1.27-alpine
COPY nginx.cloud-run.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
