# --- Stage 1: Build the production static files ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install packages first (allows Docker to cache layers optimally)
COPY frontend/package*.json ./
RUN npm ci

# Copy configuration and source files
COPY frontend/ ./

# Build the Vite application (generates a /dist folder)
RUN npm run build

# --- Stage 2: Serve the files using Nginx ---
FROM nginx:1.25-alpine

# Remove default server config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom production configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled static assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

