# Stage 1: Build
FROM node:20.17.0-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve — only ship what the browser needs
FROM nginx:alpine

# Drop the default nginx config and use ours
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the files the browser actually fetches
COPY --from=build /app/dist         /usr/share/nginx/html/dist
COPY --from=build /app/index.html   /usr/share/nginx/html/index.html
COPY --from=build /app/bootstrap.min.css /usr/share/nginx/html/bootstrap.min.css

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]