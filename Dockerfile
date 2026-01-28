FROM node:18-alpine

# Install compilers and runtimes
RUN apk add --no-cache \
    g++ \
    openjdk11 \
    python3 \
    py3-pip

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy server code
COPY server.js ./

# Create temp directory
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server.js"]
