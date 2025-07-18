# Test Automation Backend

AI destekli web test otomasyon backend servisi. Playwright kullanarak gerçek tarayıcı testleri çalıştırır.

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Playwright tarayıcılarını yükleyin:
```bash
npx playwright install
```

3. Environment dosyasını oluşturun:
```bash
cp .env.example .env
```

4. Servisi başlatın:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### POST /run-test
Test senaryosunu çalıştırır.

**Request Body:**
```json
{
  "url": "https://example.com",
  "scenario": {
    "title": "Giriş Testi",
    "steps": [
      "Ana sayfaya git",
      "Giriş butonuna tıkla",
      "Kullanıcı adı gir",
      "Şifre gir",
      "Giriş butonuna tıkla",
      "Başarılı giriş kontrolü yap"
    ],
    "data": {
      "username": "testuser@example.com",
      "password": "Test123456"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "logs": [
    "Tarayıcı başlatıldı",
    "https://example.com sayfası yüklendi",
    "Adım 1: Ana sayfaya git başlatılıyor...",
    "Adım 1: Ana sayfaya git - Başarılı",
    "Adım 2: Giriş butonuna tıkla başlatılıyor...",
    "Adım 2: Giriş butonuna tıkla - Başarılı",
    "Adım 3: Kullanıcı adı gir başlatılıyor...",
    "Kullanıcı adı girildi: testuser@example.com",
    "Adım 3: Kullanıcı adı gir - Başarılı",
    "Adım 4: Şifre gir başlatılıyor...",
    "Şifre girildi",
    "Adım 4: Şifre gir - Başarılı",
    "Adım 5: Giriş butonuna tıkla başlatılıyor...",
    "Adım 5: Giriş butonuna tıkla - Başarılı",
    "Adım 6: Başarılı giriş kontrolü yap başlatılıyor...",
    "Adım 6: Başarılı giriş kontrolü yap - Başarılı",
    "Test başarıyla tamamlandı"
  ],
  "duration": "5.2s"
}
```

### GET /health
Servis durumunu kontrol eder.

**Response:**
```json
{
  "status": "OK",
  "message": "Test Automation Backend is running"
}
```

## Desteklenen Test Adımları

Backend aşağıdaki test adımlarını otomatik olarak tanır ve çalıştırır:

- **Ana sayfaya git / Sayfaya git**: Sayfa yükleme kontrolü
- **Giriş butonuna tıkla**: Login butonunu bulup tıklar
- **Kayıt ol butonuna tıkla**: Register butonunu bulup tıklar
- **Kullanıcı adı gir**: Username/email alanını doldurur (data.username kullanır)
- **Şifre gir**: Password alanını doldurur (data.password kullanır)
- **Email gir**: Email alanını doldurur (data.email kullanır)
- **Başarılı giriş kontrolü**: Giriş sonrası dashboard/profil kontrolü
- **Başarılı kayıt kontrolü**: Kayıt sonrası başarı mesajı kontrolü
- **Boş form gönder**: Submit butonuna tıklar
- **Hata mesajlarını kontrol et**: Hata mesajlarının görünürlüğünü kontrol eder

## Element Seçicileri

Backend, yaygın kullanılan element seçicilerini otomatik olarak dener:

- **Butonlar**: `button:has-text()`, `[data-testid]`, `.class-name`, `#id`
- **Input alanları**: `input[name]`, `input[type]`, `input[placeholder*]`
- **Hata mesajları**: `.error`, `.error-message`, `.alert-danger`, `[role="alert"]`

## Geliştirme

Yeni test adımları eklemek için `executeStep` fonksiyonunu genişletin. Her adım için:

1. Adım metnini kontrol edin (`stepLower.includes()`)
2. Gerekli element seçicilerini tanımlayın
3. Element bulma ve etkileşim mantığını ekleyin
4. Hata durumlarını yönetin
5. Log mesajları ekleyin

## Güvenlik

- Headless mode varsayılan olarak aktif
- Sandbox güvenlik ayarları yapılandırılmış
- CORS politikaları uygulanmış
- Input validasyonu mevcut
