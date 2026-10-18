FROM node:22-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm ci

# Copia código-fonte
COPY . .

# Build do frontend estático
RUN npm run build

# Expõe a porta da aplicação
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "--loader", "tsx", "server.ts"]
