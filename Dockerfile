FROM node:22-slim

# System deps for sharp, pdf-to-img (canvas/poppler) and tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libvips-dev \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source, prisma schema and config
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Run migrations and start
CMD npx prisma migrate deploy && npm start
