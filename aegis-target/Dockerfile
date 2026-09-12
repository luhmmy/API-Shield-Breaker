FROM node:20-alpine
WORKDIR /app

# The app uses standard library only (zero npm dependencies)
COPY package.json ./
COPY server.js ./

# Run unprivileged for defense-in-depth
USER node

EXPOSE 4000

CMD ["node", "server.js"]
