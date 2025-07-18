# Playwright resmi imajı (Chromium, WebKit ve Firefox hazır geliyor)
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Çalışma klasörü
WORKDIR /app

# Paketleri kopyala ve kur
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Tüm kodları kopyala
COPY . .

# Sunucuyu başlat
CMD ["node", "server.js"]
