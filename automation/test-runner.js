#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function runTests() {
  const url = process.env.TEST_URL;
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  const testTypes = (process.env.TEST_TYPES || 'performance').split(',');
  
  console.log(`🚀 Starting Web Automation Tests...`);
  console.log(`🌐 Testing URL: ${url}`);
  console.log(`👤 Username: ${username || 'None'}`);
  console.log(`🧪 Test Types: ${testTypes.join(', ')}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const page = await browser.newPage();
  
  // Anti-bot detection measures
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });
  
  // Remove automation indicators (Playwright compatible)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  
  const results = [];
  
  try {
    // Navigate to page with multiple strategies
    console.log('📄 Loading page...');
    
    let pageLoaded = false;
    const strategies = [
      { waitUntil: 'domcontentloaded', timeout: 45000 },
      { waitUntil: 'load', timeout: 60000 },
      { waitUntil: 'networkidle', timeout: 30000 }
    ];
    
    for (const strategy of strategies) {
      try {
        console.log(`🔄 Trying strategy: ${strategy.waitUntil} (${strategy.timeout}ms)`);
        await page.goto(url, strategy);
        pageLoaded = true;
        console.log(`✅ Page loaded with strategy: ${strategy.waitUntil}`);
        break;
      } catch (error) {
        console.log(`⚠️ Strategy ${strategy.waitUntil} failed: ${error.message}`);
        if (strategy === strategies[strategies.length - 1]) {
          throw error;
        }
      }
    }
    
    if (!pageLoaded) {
      throw new Error('All loading strategies failed');
    }
    
    // Wait a bit more for dynamic content
    await page.waitForTimeout(3000);
    console.log('✅ Page loaded successfully');
    
    // Login if credentials provided
    if (username && password) {
      console.log('🔐 Attempting login...');
      try {
        // Wait for login form to be ready
        await page.waitForTimeout(2000);
        
        // Try multiple login selectors
        const usernameSelectors = [
          'input[name="username"]',
          'input[name="email"]', 
          'input[type="email"]',
          'input[id*="username"]',
          'input[id*="email"]',
          'input[placeholder*="kullanıcı" i]',
          'input[placeholder*="email" i]'
        ];
        
        const passwordSelectors = [
          'input[type="password"]',
          'input[name="password"]',
          'input[id*="password"]',
          'input[placeholder*="şifre" i]'
        ];
        
        let usernameField = null;
        let passwordField = null;
        
        // Find username field
        for (const selector of usernameSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            usernameField = selector;
            break;
          } catch (e) {
            continue;
          }
        }
        
        // Find password field
        for (const selector of passwordSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            passwordField = selector;
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (usernameField && passwordField) {
          await page.fill(usernameField, username);
          await page.fill(passwordField, password);
          
          // Try to submit
          const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Giriş")',
            'button:has-text("Login")',
            '.login-button',
            '.btn-login'
          ];
          
          let submitted = false;
          for (const selector of submitSelectors) {
            try {
              await page.click(selector);
              submitted = true;
              break;
            } catch (e) {
              continue;
            }
          }
          
          if (!submitted) {
            // Try pressing Enter on password field
            await page.press(passwordField, 'Enter');
          }
          
          await page.waitForTimeout(5000);
          console.log('✅ Login attempted');
        } else {
          console.log('⚠️ Login form not found');
        }
      } catch (loginError) {
        console.log('⚠️ Login failed or not needed:', loginError.message);
      }
    }
    
    // Performance Test
    if (testTypes.includes('performance')) {
      console.log('⚡ Running performance test...');
      try {
        const loadTime = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;
        });
        
        const score = Math.max(0, 100 - (loadTime / 50));
        results.push({
          testName: 'Performance Test',
          status: loadTime < 3000 ? 'passed' : loadTime < 5000 ? 'warning' : 'failed',
          score: Math.round(score),
          details: [
            `Load time: ${Math.round(loadTime)}ms`,
            `Performance score: ${Math.round(score)}%`,
            loadTime < 3000 ? 'Excellent performance' : loadTime < 5000 ? 'Good performance' : 'Needs optimization'
          ]
        });
        console.log(`✅ Performance test completed: ${Math.round(loadTime)}ms`);
      } catch (error) {
        results.push({
          testName: 'Performance Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // Security Test
    if (testTypes.includes('security')) {
      console.log('🛡️ Running security test...');
      try {
        const isHTTPS = url.startsWith('https://');
        const response = await page.goto(url);
        const headers = response.headers();
        
        let securityScore = 0;
        const securityChecks = [];
        
        if (isHTTPS) {
          securityScore += 25;
          securityChecks.push('✅ HTTPS enabled');
        } else {
          securityChecks.push('❌ HTTPS not enabled');
        }
        
        if (headers['strict-transport-security']) {
          securityScore += 25;
          securityChecks.push('✅ HSTS header present');
        } else {
          securityChecks.push('❌ HSTS header missing');
        }
        
        if (headers['x-frame-options']) {
          securityScore += 25;
          securityChecks.push('✅ X-Frame-Options header present');
        } else {
          securityChecks.push('❌ X-Frame-Options header missing');
        }
        
        if (headers['content-security-policy']) {
          securityScore += 25;
          securityChecks.push('✅ CSP header present');
        } else {
          securityChecks.push('❌ CSP header missing');
        }
        
        results.push({
          testName: 'Security Test',
          status: securityScore > 75 ? 'passed' : securityScore > 50 ? 'warning' : 'failed',
          score: securityScore,
          details: securityChecks
        });
        console.log(`✅ Security test completed: ${securityScore}% score`);
      } catch (error) {
        results.push({
          testName: 'Security Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // Forms Test
    if (testTypes.includes('forms')) {
      console.log('📝 Running forms test...');
      try {
        const formCount = await page.locator('form').count();
        const inputCount = await page.locator('input').count();
        const requiredInputs = await page.locator('input[required]').count();
        
        const validationScore = formCount > 0 ? Math.min(100, (requiredInputs / inputCount) * 100 + 50) : 0;
        
        results.push({
          testName: 'Forms Test',
          status: validationScore > 70 ? 'passed' : validationScore > 40 ? 'warning' : 'failed',
          score: Math.round(validationScore),
          details: [
            `Forms found: ${formCount}`,
            `Input fields: ${inputCount}`,
            `Required fields: ${requiredInputs}`,
            `Validation coverage: ${Math.round((requiredInputs / inputCount) * 100)}%`
          ]
        });
        console.log(`✅ Forms test completed: ${formCount} forms, ${inputCount} inputs`);
      } catch (error) {
        results.push({
          testName: 'Forms Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // Links Test
    if (testTypes.includes('links')) {
      console.log('🔗 Running links test...');
      try {
        const linkCount = await page.locator('a[href]').count();
        const externalLinks = await page.locator('a[href^="http"]:not([href*="' + new URL(url).hostname + '"])').count();
        const internalLinks = linkCount - externalLinks;
        
        // Test a sample of links
        const links = await page.locator('a[href]').all();
        let brokenLinks = 0;
        const sampleSize = Math.min(5, links.length);
        
        for (let i = 0; i < sampleSize; i++) {
          try {
            const href = await links[i].getAttribute('href');
            if (href && href.startsWith('http')) {
              const response = await page.request.get(href);
              if (response.status() >= 400) {
                brokenLinks++;
              }
            }
          } catch (e) {
            brokenLinks++;
          }
        }
        
        const linkScore = Math.max(0, 100 - (brokenLinks * 20));
        
        results.push({
          testName: 'Links Test',
          status: linkScore > 80 ? 'passed' : linkScore > 60 ? 'warning' : 'failed',
          score: linkScore,
          details: [
            `Total links: ${linkCount}`,
            `Internal links: ${internalLinks}`,
            `External links: ${externalLinks}`,
            `Broken links (sample): ${brokenLinks}/${sampleSize}`,
            `Link health: ${Math.round(((sampleSize - brokenLinks) / sampleSize) * 100)}%`
          ]
        });
        console.log(`✅ Links test completed: ${linkCount} links, ${brokenLinks} broken`);
      } catch (error) {
        results.push({
          testName: 'Links Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // SEO Test
    if (testTypes.includes('seo')) {
      console.log('📊 Running SEO test...');
      try {
        const title = await page.title();
        const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
        const h1Count = await page.locator('h1').count();
        const imgWithoutAlt = await page.locator('img:not([alt])').count();
        const totalImages = await page.locator('img').count();
        
        let seoScore = 0;
        const seoChecks = [];
        
        if (title && title.length > 10 && title.length < 60) {
          seoScore += 25;
          seoChecks.push('✅ Title tag: Good length');
        } else {
          seoChecks.push('❌ Title tag: Missing or wrong length');
        }
        
        if (metaDescription && metaDescription.length > 120 && metaDescription.length < 160) {
          seoScore += 25;
          seoChecks.push('✅ Meta description: Good length');
        } else {
          seoChecks.push('❌ Meta description: Missing or wrong length');
        }
        
        if (h1Count === 1) {
          seoScore += 25;
          seoChecks.push('✅ H1 tag: Exactly one found');
        } else {
          seoChecks.push(`❌ H1 tag: ${h1Count} found (should be 1)`);
        }
        
        if (totalImages === 0 || imgWithoutAlt === 0) {
          seoScore += 25;
          seoChecks.push('✅ Image alt tags: All images have alt text');
        } else {
          seoChecks.push(`❌ Image alt tags: ${imgWithoutAlt}/${totalImages} missing`);
        }
        
        results.push({
          testName: 'SEO Test',
          status: seoScore > 75 ? 'passed' : seoScore > 50 ? 'warning' : 'failed',
          score: seoScore,
          details: seoChecks
        });
        console.log(`✅ SEO test completed: ${seoScore}% score`);
      } catch (error) {
        results.push({
          testName: 'SEO Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // Accessibility Test
    if (testTypes.includes('accessibility')) {
      console.log('♿ Running accessibility test...');
      try {
        const imagesWithoutAlt = await page.locator('img:not([alt])').count();
        const buttonsWithoutLabel = await page.locator('button:not([aria-label]):not(:has-text(""))').count();
        const inputsWithoutLabel = await page.locator('input:not([aria-label]):not([id])').count();
        const headingStructure = await page.locator('h1, h2, h3, h4, h5, h6').count();
        
        let a11yScore = 100;
        const a11yIssues = [];
        
        if (imagesWithoutAlt > 0) {
          a11yScore -= 20;
          a11yIssues.push(`❌ ${imagesWithoutAlt} images without alt text`);
        } else {
          a11yIssues.push('✅ All images have alt text');
        }
        
        if (buttonsWithoutLabel > 0) {
          a11yScore -= 20;
          a11yIssues.push(`❌ ${buttonsWithoutLabel} buttons without labels`);
        } else {
          a11yIssues.push('✅ All buttons have labels');
        }
        
        if (inputsWithoutLabel > 0) {
          a11yScore -= 20;
          a11yIssues.push(`❌ ${inputsWithoutLabel} inputs without labels`);
        } else {
          a11yIssues.push('✅ All inputs have labels');
        }
        
        if (headingStructure > 0) {
          a11yIssues.push(`✅ Heading structure: ${headingStructure} headings found`);
        } else {
          a11yScore -= 20;
          a11yIssues.push('❌ No heading structure found');
        }
        
        results.push({
          testName: 'Accessibility Test',
          status: a11yScore > 80 ? 'passed' : a11yScore > 60 ? 'warning' : 'failed',
          score: Math.max(0, a11yScore),
          details: a11yIssues
        });
        console.log(`✅ Accessibility test completed: ${Math.max(0, a11yScore)}% score`);
      } catch (error) {
        results.push({
          testName: 'Accessibility Test',
          status: 'failed',
          score: 0,
          details: [`Error: ${error.message}`]
        });
      }
    }
    
    // Create final report
    const overallScore = results.length > 0 ? Math.round(
      results.reduce((sum, result) => sum + result.score, 0) / results.length
    ) : 0;
    
    const report = {
      url,
      timestamp: new Date().toISOString(),
      overallScore,
      results,
      summary: {
        passed: results.filter(r => r.status === 'passed').length,
        warning: results.filter(r => r.status === 'warning').length,
        failed: results.filter(r => r.status === 'failed').length,
        total: results.length
      }
    };
    
    // Save results
    await fs.mkdir('results', { recursive: true });
    await fs.writeFile('results/test-report.json', JSON.stringify(report, null, 2));
    
    console.log('📊 Test Report Generated:');
    console.log(`   Overall Score: ${overallScore}%`);
    console.log(`   Tests: ${report.summary.passed} passed, ${report.summary.warning} warnings, ${report.summary.failed} failed`);
    
    // Create summary
    const summary = `# 🤖 Web Automation Test Results

## Summary
- **URL:** ${url}
- **Overall Score:** ${overallScore}%
- **Tests:** ${report.summary.passed} passed, ${report.summary.warning} warnings, ${report.summary.failed} failed

## Results
${results.map(r => `- **${r.testName}:** ${r.status === 'passed' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'} ${r.score}%`).join('\n')}

## Details
${results.map(r => `
### ${r.testName}
- **Status:** ${r.status}
- **Score:** ${r.score}%
- **Details:** ${r.details.join(', ')}
`).join('\n')}
`;

    await fs.writeFile('results/summary.md', summary);
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Create error report
    await fs.mkdir('results', { recursive: true });
    await fs.writeFile('results/error-report.json', JSON.stringify({
      url,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    }, null, 2));
    
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
