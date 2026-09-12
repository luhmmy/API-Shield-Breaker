FROM node:20-alpine
WORKDIR /app

# Zero external npm dependencies
COPY package.json ./
COPY server.js ./

# Create data directory for persistent game state and ensure node user has write permissions
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV PORT=3000
ENV STATE_FILE=/app/data/ctf-state.json

EXPOSE 3000

CMD ["node", "server.js"]
