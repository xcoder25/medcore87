FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install
COPY . .
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "dev"]
