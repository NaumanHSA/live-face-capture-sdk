# Use an official Node.js runtime as a parent image
FROM node:18.16.1 as build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json into the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code into the working directory
COPY . .

# Build the project using Rollup
RUN npm run build

# Stage 2: Use a lightweight Nginx image to serve the app
FROM nginx:alpine

# Copy the built Angular app from the previous stage
COPY --from=build /app /usr/share/nginx/html

# Expose port 80 (default for HTTP)
EXPOSE 80

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]
#docker build -t ssms-dashboard-web .
#docker save -o ssms-dashboard-web.tar ssms-dashboard-web
# docker load -i ssms-dashboard-web.tar