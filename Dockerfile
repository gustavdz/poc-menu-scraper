FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist

EXPOSE 3333

CMD ["node", "dist/main.js"]