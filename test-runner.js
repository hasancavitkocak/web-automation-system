#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class WebAutomationRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🚀 Starting Web Automation Runner...');
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
  }

  async runTests() {
    const url = process.env.TEST_URL;
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    const testTypes = (process.env.TEST_TYPES || 'performance,security,forms,links,seo,accessibility').split(',');

    console.log(`🌐 Testing URL: ${url}`);
    console.log(`🧪 Test Types: ${testTypes.join(', ')}`);

    try {
      // Navigate to the page
      console.log('📄 Loading page...');
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Check if login is required and attempt login
      let loginSuccessful = false;
      if (username && password) {
        console.log('🔐 Attempting login...');
        loginSuccessful = await this.attemptLogin(username, password);
      }

      // Run selected tests
      for (const testType of testTypes) {
        console.log(`🧪 Running ${testType} test...`);
        await this.runSingleTest(testType.trim(), loginSuccessful);
      }

      // Generate final report
      await this.generateReport(url, loginSuccessful);

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      await this.generateErrorReport(url, error);
    }
  }

  async attemptLogin(username, password) {
    try {
      // Look for common login form selectors
      const loginSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[name="user"]',
        'input[id*="email"]',
        'input[id*="username"]',
        'input[id*="user"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
        'input[placeholder*="kullanıcı" i]'
      ];

      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[name="pass"]',
        'input[id*="password"]',
        'input[id*="pass"]',
        'input[placeholder*="password" i]',
        'input[placeholder*="şifre" i]'
      ];

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button:has-text("Giriş")',
        'button:has-text("Oturum Aç")',
        '.login-button',
        '.btn-login',
        '#login-btn'
      ];

      // Find username field
      let usernameField = null;
      for (const selector of loginSelectors) {
        try {
          usernameField = await this.page.locator(selector).first();
          if (await usernameField.isVisible()) break;
        } catch (e) {
          continue;
        }
      }

      // Find password field
      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await this.page.locator(selector).first();
          if (await passwordField.isVisible()) break;
        } catch (e) {
          continue;
        }
      }

      if (!usernameField || !passwordField) {
        console.log('⚠️ Login fields not found');
        return false;
      }

      // Fill credentials
      await usernameField.fill(username);
      await passwordField.fill(password);

      // Find and click submit button
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await this.page.locator(selector).first();
          if (await submitButton.isVisible()) break;
        } catch (e) {
          continue;
        }
      }

      if (submitButton) {
        await submitButton.click();
      } else {
        // Try pressing Enter on password field
        await passwordField.press('Enter');
      }

      // Wait for navigation or error
      await this.page.waitForTimeout(3000);

      // Check if login was successful
      const currentUrl = this.page.url();
      const hasErrorMessage = await this.page.locator('text=/error|invalid|wrong|hata|geçersiz/i').count() > 0;
      const hasLoginForm = await this.page.locator('input[type="password"]').count() > 0;

      const loginSuccess = !hasErrorMessage && (!hasLoginForm || currentUrl !== process.env.TEST_URL);
      
      console.log(loginSuccess ? '✅ Login successful' : '❌ Login failed');
      return loginSuccess;

    } catch (error) {
      console.log('❌ Login error:', error.message);
      return false;
    }
  }

  async runSingleTest(testType, loginSuccessful) {
    const testStart = Date.now();
    let result = {
      testName: testType.charAt(0).toUpperCase() + testType.slice(1) + ' Test',
      status: 'failed',
      score: 0,
      description: '',
      duration: 0,
      details: [],
      logs: []
    };

    try {
      switch (testType) {
        case 'performance':
          result = await this.runPerformanceTest();
          break;
        case 'security':
          result = await this.runSecurityTest();
          break;
        case 'forms':
          result = await this.runFormsTest();
          break;
        case 'links':
          result = await this.runLinksTest();
          break;
        case 'seo':
          result = await this.runSEOTest();
          break;
        case 'accessibility':
          result = await this.runAccessibilityTest();
          break;
        default:
          result.description = `Unknown test type: ${testType}`;
      }
    } catch (error) {
      result.logs.push(`Test error: ${error.message}`);
      result.details.push(`❌ Test failed: ${error.message}`);
    }

    result.duration = Date.now() - testStart;
    this.results.push(result);
  }

  async runPerformanceTest() {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    const score = Math.max(0, 100 - (metrics.loadTime / 50));

    return {
      testName: 'Performance Test',
      status: score > 70 ? 'passed' : score > 50 ? 'warning' : 'failed',
      score: Math.round(score),
      description: 'Real browser performance metrics analysis',
      details: [
        `⏱️ Load Time: ${Math.round(metrics.loadTime)}ms`,
        `📄 DOM Content Loaded: ${Math.round(metrics.domContentLoaded)}ms`,
        `🎨 First Paint: ${Math.round(metrics.firstPaint)}ms`,
        `🖼️ First Contentful Paint: ${Math.round(metrics.firstContentfulPaint)}ms`
      ],
      logs: ['Performance metrics collected from real browser']
    };
  }

  async runSecurityTest() {
    const securityChecks = [];
    
    // Check HTTPS
    const isHTTPS = this.page.url().startsWith('https://');
    securityChecks.push(`🔒 HTTPS: ${isHTTPS ? '✅' : '❌'}`);

    // Check for mixed content
    const mixedContent = await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return resources.some(r => r.name.startsWith('http://'));
    });
    securityChecks.push(`🔗 Mixed Content: ${mixedContent ? '❌' : '✅'}`);

    // Check for security headers
    const response = await this.page.goto(this.page.url());
    const headers = response.headers();
    const hasCSP = headers['content-security-policy'] || headers['x-content-security-policy'];
    const hasXFrame = headers['x-frame-options'];
    
    securityChecks.push(`🛡️ Content Security Policy: ${hasCSP ? '✅' : '❌'}`);
    securityChecks.push(`🖼️ X-Frame-Options: ${hasXFrame ? '✅' : '❌'}`);

    const score = securityChecks.filter(check => check.includes('✅')).length * 25;

    return {
      testName: 'Security Test',
      status: score > 75 ? 'passed' : score > 50 ? 'warning' : 'failed',
      score,
      description: 'Real security headers and HTTPS analysis',
      details: securityChecks,
      logs: ['Security headers analyzed from real HTTP response']
    };
  }

  async runFormsTest() {
    const forms = await this.page.locator('form').count();
    const inputs = await this.page.locator('input').count();
    const requiredInputs = await this.page.locator('input[required]').count();
    
    const score = forms > 0 ? Math.min(100, (requiredInputs / inputs) * 100 + 50) : 0;

    return {
      testName: 'Forms Test',
      status: score > 70 ? 'passed' : score > 40 ? 'warning' : 'failed',
      score: Math.round(score),
      description: 'Real DOM form elements analysis',
      details: [
        `📝 Forms found: ${forms}`,
        `📋 Input fields: ${inputs}`,
        `⚠️ Required fields: ${requiredInputs}`,
        `✅ Validation ratio: ${Math.round((requiredInputs / inputs) * 100)}%`
      ],
      logs: ['Form elements counted from real DOM']
    };
  }

  async runLinksTest() {
    const links = await this.page.locator('a[href]').count();
    const externalLinks = await this.page.locator('a[href^="http"]:not([href*="' + new URL(this.page.url()).hostname + '"])').count();
    const internalLinks = links - externalLinks;

    // Test a sample of links
    const linkElements = await this.page.locator('a[href]').all();
    let brokenLinks = 0;
    const sampleSize = Math.min(10, linkElements.length);

    for (let i = 0; i < sampleSize; i++) {
      try {
        const href = await linkElements[i].getAttribute('href');
        if (href && href.startsWith('http')) {
          const response = await this.page.request.get(href);
          if (response.status() >= 400) {
            brokenLinks++;
          }
        }
      } catch (e) {
        brokenLinks++;
      }
    }

    const score = Math.max(0, 100 - (brokenLinks * 20));

    return {
      testName: 'Links Test',
      status: score > 80 ? 'passed' : score > 60 ? 'warning' : 'failed',
      score,
      description: 'Real link validation and testing',
      details: [
        `🔗 Total links: ${links}`,
        `🏠 Internal links: ${internalLinks}`,
        `🌐 External links: ${externalLinks}`,
        `❌ Broken links (sample): ${brokenLinks}/${sampleSize}`,
        `✅ Link health: ${Math.round(((sampleSize - brokenLinks) / sampleSize) * 100)}%`
      ],
      logs: [`Tested ${sampleSize} links from real DOM`]
    };
  }

  async runSEOTest() {
    const title = await this.page.title();
    const metaDescription = await this.page.locator('meta[name="description"]').getAttribute('content');
    const h1Count = await this.page.locator('h1').count();
    const imgWithoutAlt = await this.page.locator('img:not([alt])').count();
    const totalImages = await this.page.locator('img').count();

    let score = 0;
    const checks = [];

    if (title && title.length > 10 && title.length < 60) {
      score += 25;
      checks.push('✅ Title tag: Good length');
    } else {
      checks.push('❌ Title tag: Missing or wrong length');
    }

    if (metaDescription && metaDescription.length > 120 && metaDescription.length < 160) {
      score += 25;
      checks.push('✅ Meta description: Good length');
    } else {
      checks.push('❌ Meta description: Missing or wrong length');
    }

    if (h1Count === 1) {
      score += 25;
      checks.push('✅ H1 tag: Exactly one found');
    } else {
      checks.push(`❌ H1 tag: ${h1Count} found (should be 1)`);
    }

    if (totalImages === 0 || imgWithoutAlt === 0) {
      score += 25;
      checks.push('✅ Image alt tags: All images have alt text');
    } else {
      checks.push(`❌ Image alt tags: ${imgWithoutAlt}/${totalImages} missing`);
    }

    return {
      testName: 'SEO Test',
      status: score > 75 ? 'passed' : score > 50 ? 'warning' : 'failed',
      score,
      description: 'Real SEO elements analysis',
      details: checks,
      logs: ['SEO elements analyzed from real DOM']
    };
  }

  async runAccessibilityTest() {
    // Basic accessibility checks
    const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
    const buttonsWithoutLabel = await this.page.locator('button:not([aria-label]):not(:has-text(""))').count();
    const inputsWithoutLabel = await this.page.locator('input:not([aria-label]):not([id])').count();
    const headingStructure = await this.page.locator('h1, h2, h3, h4, h5, h6').count();

    let score = 100;
    const issues = [];

    if (imagesWithoutAlt > 0) {
      score -= 20;
      issues.push(`❌ ${imagesWithoutAlt} images without alt text`);
    } else {
      issues.push('✅ All images have alt text');
    }

    if (buttonsWithoutLabel > 0) {
      score -= 20;
      issues.push(`❌ ${buttonsWithoutLabel} buttons without labels`);
    } else {
      issues.push('✅ All buttons have labels');
    }

    if (inputsWithoutLabel > 0) {
      score -= 20;
      issues.push(`❌ ${inputsWithoutLabel} inputs without labels`);
    } else {
      issues.push('✅ All inputs have labels');
    }

    if (headingStructure > 0) {
      issues.push(`✅ Heading structure: ${headingStructure} headings found`);
    } else {
      score -= 20;
      issues.push('❌ No heading structure found');
    }

    return {
      testName: 'Accessibility Test',
      status: score > 80 ? 'passed' : score > 60 ? 'warning' : 'failed',
      score: Math.max(0, score),
      description: 'Real accessibility compliance check',
      details: issues,
      logs: ['Accessibility elements analyzed from real DOM']
    };
  }

  async generateReport(url, loginSuccessful) {
    const overallScore = Math.round(
      this.results.reduce((sum, result) => sum + result.score, 0) / this.results.length
    );

    const report = {
      url,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      loginAttempted: !!process.env.TEST_USERNAME,
      loginSuccessful,
      overallScore,
      results: this.results,
      summary: {
        passed: this.results.filter(r => r.status === 'passed').length,
        warning: this.results.filter(r => r.status === 'warning').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        total: this.results.length
      }
    };

    // Ensure results directory exists
    await fs.mkdir('results', { recursive: true });
    
    // Write detailed report
    await fs.writeFile('results/test-report.json', JSON.stringify(report, null, 2));
    
    // Write summary for GitHub Actions
    const summary = `# 🤖 Web Automation Test Results

## Summary
- **URL:** ${url}
- **Overall Score:** ${overallScore}%
- **Login:** ${loginSuccessful ? '✅ Successful' : '❌ Failed/Not attempted'}
- **Duration:** ${Math.round((Date.now() - this.startTime) / 1000)}s

## Test Results
${this.results.map(r => `- **${r.testName}:** ${r.status === 'passed' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'} ${r.score}%`).join('\n')}

## Details
${this.results.map(r => `
### ${r.testName}
- **Status:** ${r.status}
- **Score:** ${r.score}%
- **Duration:** ${r.duration}ms
- **Details:** ${r.details.join(', ')}
`).join('\n')}
`;

    await fs.writeFile('results/summary.md', summary);
    
    console.log('📊 Test Report Generated:');
    console.log(`   Overall Score: ${overallScore}%`);
    console.log(`   Tests: ${report.summary.passed} passed, ${report.summary.warning} warnings, ${report.summary.failed} failed`);
  }

  async generateErrorReport(url, error) {
    const errorReport = {
      url,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      results: this.results
    };

    await fs.mkdir('results', { recursive: true });
    await fs.writeFile('results/error-report.json', JSON.stringify(errorReport, null, 2));
    
    console.log('❌ Error Report Generated');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const runner = new WebAutomationRunner();
  
  try {
    await runner.initialize();
    await runner.runTests();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebAutomationRunner;