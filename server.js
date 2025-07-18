const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Playwright'ın çalışır durumda olduğunu doğrulamak için bir tarayıcı başlatmayı deneyin
    const browser = await chromium.launch({ headless: true, timeout: 5000 });
    await browser.close();
    res.json({ status: 'OK', message: 'Test Otomasyon Backend çalışıyor ve Playwright işlevsel' });
  } catch (error) {
    console.error('Sağlık kontrolü başarısız: Playwright tarayıcı başlatma hatası:', error);
    res.status(500).json({ status: 'ERROR', message: 'Test Otomasyon Backend çalışıyor ancak Playwright işlevsel değil', error: error.message });
  }
});

// Test çalıştırma endpoint'i
app.post('/run-test', async (req, res) => {
  const { url, scenario } = req.body;
  
  if (!url || !scenario || !scenario.steps || !Array.isArray(scenario.steps)) {
    console.error('Geçersiz istek: URL ve senaryo adımları gerekli.', { url, scenario });
    return res.status(400).json({
      success: false,
      logs: ['Geçersiz istek: URL ve senaryo adımları gerekli'],
      duration: '0s'
    });
  }

  let browser;
  let page;
  const logs = [];
  const startTime = Date.now();

  try {
    // Tarayıcı başlat
    logs.push(`Tarayıcı başlatılıyor...`);
    browser = await chromium.launch({ 
      headless: true, // Sunucu ortamında tarayıcı arayüzünü göstermeden çalışır
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Güvenlik ve uyumluluk için önerilir
    });
    logs.push(`Tarayıcı başlatıldı`);

    page = await browser.newPage();
    logs.push(`Yeni sayfa açıldı`);

    // Sayfa yükle
    logs.push(`${url} sayfasına gidiliyor...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); // Sayfa yükleme için daha uzun zaman tanındı
    logs.push(`${url} sayfası yüklendi`);

    // Test adımlarını çalıştır
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      logs.push(`Adım ${i + 1}: "${step}" başlatılıyor...`);

      try {
        await executeStep(page, step, scenario.data, logs);
        logs.push(`Adım ${i + 1}: "${step}" - Başarılı`);
      } catch (error) {
        logs.push(`Adım ${i + 1}: "${step}" - Hata: ${error.message}`);
        throw error; // Hata durumunda testi başarısız olarak işaretlemek için hatayı yeniden fırlat
      }

      // Adımlar arası kısa bekleme (stabilite için)
      await page.waitForTimeout(1000);
    }

    const endTime = Date.now();
    const duration = `${((endTime - startTime) / 1000).toFixed(1)}s`;
    
    logs.push('Test başarıyla tamamlandı');

    res.json({
      success: true,
      logs,
      duration
    });

  } catch (error) {
    const endTime = Date.now();
    const duration = `${((endTime - startTime) / 1000).toFixed(1)}s`;
    
    logs.push(`Test başarısız: ${error.message}`);
    console.error('Test çalıştırma başarısız oldu:', error); // Sunucu tarafında hatayı logla
    
    res.json({
      success: false,
      logs,
      duration
    });
  } finally {
    if (browser) {
      logs.push('Tarayıcı kapatılıyor...');
      await browser.close();
      logs.push('Tarayıcı kapatıldı');
    }
  }
});

// Test adımlarını çalıştıran yardımcı fonksiyon
async function executeStep(page, step, data, logs) {
  const stepLower = step.toLowerCase();

  if (stepLower.includes('ana sayfaya git') || stepLower.includes('sayfaya git')) {
    await page.waitForLoadState('networkidle');
    
  } else if (stepLower.includes('giriş butonuna tıkla') || stepLower.includes('login')) {
    const loginSelectors = [
      'button:has-text("Giriş")', 'button:has-text("Login")',
      'a:has-text("Giriş")', 'a:has-text("Login")',
      '[data-testid="login-button"]', '.login-button', '#login-button'
    ];
    await findAndClick(page, loginSelectors, 'Giriş butonu', logs);
    
  } else if (stepLower.includes('kayıt ol') || stepLower.includes('register')) {
    const registerSelectors = [
      'button:has-text("Kayıt")', 'button:has-text("Register")',
      'a:has-text("Kayıt")', 'a:has-text("Register")',
      '[data-testid="register-button"]', '.register-button', '#register-button'
    ];
    await findAndClick(page, registerSelectors, 'Kayıt ol butonu', logs);
    
  } else if (stepLower.includes('kullanıcı adı gir') || stepLower.includes('username')) {
    if (!data || !data.username) { throw new Error('Kullanıcı adı verisi bulunamadı'); }
    const usernameSelectors = [
      'input[name="username"]', 'input[name="email"]', 'input[type="email"]',
      'input[placeholder*="kullanıcı"]', 'input[placeholder*="email"]',
      '[data-testid="username"]', '#username', '#email'
    ];
    await findAndFill(page, usernameSelectors, data.username, 'Kullanıcı adı alanı', logs);
    
  } else if (stepLower.includes('şifre gir') || stepLower.includes('password')) {
    if (!data || !data.password) { throw new Error('Şifre verisi bulunamadı'); }
    const passwordSelectors = [
      'input[name="password"]', 'input[type="password"]',
      'input[placeholder*="şifre"]', 'input[placeholder*="password"]',
      '[data-testid="password"]', '#password'
    ];
    await findAndFill(page, passwordSelectors, data.password, 'Şifre alanı', logs, true); // Şifreyi loglarda maskele
    
  } else if (stepLower.includes('email gir')) {
    if (!data || !data.email) { throw new Error('Email verisi bulunamadı'); }
    const emailSelectors = [
      'input[name="email"]', 'input[type="email"]',
      'input[placeholder*="email"]', '[data-testid="email"]', '#email'
    ];
    await findAndFill(page, emailSelectors, data.email, 'Email alanı', logs);
    
  } else if (stepLower.includes('başarılı giriş kontrolü') || stepLower.includes('giriş kontrolü')) {
    const successSelectors = [
      'button:has-text("Çıkış")', 'button:has-text("Logout")',
      'a:has-text("Profil")', 'a:has-text("Dashboard")',
      '.dashboard', '.profile', '[data-testid="user-menu"]'
    ];
    await findAndAssert(page, successSelectors, 'Başarılı giriş göstergesi', logs);
    
  } else if (stepLower.includes('başarılı kayıt kontrolü') || stepLower.includes('kayıt kontrolü')) {
    const successSelectors = [
      'text="Kayıt başarılı"', 'text="Registration successful"',
      'text="Hoş geldiniz"', '.success-message', '[data-testid="success-message"]'
    ];
    await findAndAssert(page, successSelectors, 'Başarılı kayıt göstergesi', logs);
    
  } else if (stepLower.includes('boş form gönder')) {
    const submitSelectors = [
      'button[type="submit"]', 'input[type="submit"]',
      'button:has-text("Gönder")', 'button:has-text("Submit")', '.submit-button'
    ];
    await findAndClick(page, submitSelectors, 'Gönder butonu', logs);
    
  } else if (stepLower.includes('hata mesajlarını kontrol et')) {
    const errorSelectors = [
      '.error', '.error-message', '.alert-danger', '[role="alert"]',
      'text="Bu alan zorunludur"', 'text="Required field"'
    ];
    await findAndAssert(page, errorSelectors, 'Hata mesajları', logs);
    
  } else {
    logs.push(`Genel adım çalıştırıldı: ${step} (1 saniye bekleniyor)`);
    await page.waitForTimeout(1000);
  }
}

// Ortak Playwright eylemleri için yardımcı fonksiyonlar
async function findAndClick(page, selectors, description, logs) {
  let clicked = false;
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 5000 }); // Tıklamalar için daha uzun zaman tanındı
      clicked = true;
      logs.push(`${description} tıklandı: ${selector}`);
      break;
    } catch (e) {
      continue;
    }
  }
  if (!clicked) {
    throw new Error(`${description} bulunamadı veya tıklanamadı.`);
  }
}

async function findAndFill(page, selectors, value, description, logs, maskValue = false) {
  let filled = false;
  for (const selector of selectors) {
    try {
      await page.fill(selector, value, { timeout: 5000 }); // Doldurmalar için daha uzun zaman tanındı
      filled = true;
      logs.push(`${description} dolduruldu: ${maskValue ? '***' : value}`);
      break;
    } catch (e) {
      continue;
    }
  }
  if (!filled) {
    throw new Error(`${description} alanı bulunamadı veya doldurulamadı.`);
  }
}

async function findAndAssert(page, selectors, description, logs) {
  let found = false;
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 }); // Doğrulamalar için daha uzun zaman tanındı
      found = true;
      logs.push(`${description} doğrulandı: ${selector}`);
      break;
    } catch (e) {
      continue;
    }
  }
  if (!found) {
    throw new Error(`${description} bulunamadı.`);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Test Otomasyon Backend ${PORT} portunda çalışıyor`);
  console.log(`📋 Sağlık kontrolü: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: POST http://localhost:${PORT}/run-test`);
});
