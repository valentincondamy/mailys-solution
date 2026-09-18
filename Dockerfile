FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node index.html styles.css script.js server.mjs ./
COPY --chown=node:node outputs ./outputs

ENV NODE_ENV=production
ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "server.mjs"]
