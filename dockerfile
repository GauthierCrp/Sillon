# --- ÉTAPE 1 : Construction (Build) ---
FROM node:22-alpine AS builder

# On installe les outils de build SANS l'option --no-network
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# --- ÉTAPE 2 : Image Finale (Run) ---
FROM node:22-alpine

# Installation des dépendances runtime nécessaires pour Sharp/SQLite sur Alpine
RUN apk add --no-cache vips-dev

WORKDIR /usr/src/app

# On récupère uniquement le nécessaire
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

EXPOSE 3002

CMD ["node", "app.js"]
