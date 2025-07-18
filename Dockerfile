# Playwright’ın Chromium, Firefox ve WebKit yüklü resmi imajını kullanıyoruz
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Çalışma dizini
WORKDIR /app

# Sadece package.json'ı kopyala (yarn.lock olmadığı için tek dosya)
COPY package.json ./

# Bağımlılıkları kur (yarn.lock yoksa otomatik kurulum yapacak)
RUN yarn install

# Tüm proje dosyalarını kopyala
COPY . .

# Sunucuyu başlat
CMD ["node", "server.js"]
