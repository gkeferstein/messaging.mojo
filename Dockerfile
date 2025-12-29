FROM node:22-slim

WORKDIR /app

# Installiere Abhängigkeiten für Build
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Kopiere package files
COPY package*.json ./

# Installiere Dependencies
RUN npm ci --only=production

# Kopiere App-Code
COPY . .

# Exponiere Port
EXPOSE 3020

# Start-Befehl
CMD ["node", "server.js"]
