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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const results = [];
  
  try {
    // Navigate to page
    console.log('📄 Loading page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Page loaded successfully');
    
    // Login if credentials provided
    if (username && password) {
      console.log('🔐 Attempting login...');
      try {
        await page.fill('input[name="username"], input[name="email"], input[type="email"]', username);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"], input[type="submit"]');
        await page.waitForTimeout(2000);
        console.log('✅ Login attempted');
      } catch (loginError) {
        console.log('⚠️ Login failed or not needed');
      }
    }
    
    // Performance Test
    if (testTypes.includes('performance')) {
      console.log('⚡ Running performance test...');
      const loadTime = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;
      });
      
      const score = Math.max(0, 100 - (loadTime / 50));
      results.push({
        testName: 'Performance Test',
        status: loadTime < 3000 ? 'passed' : 'warning',
        score: Math.round(score),
        details: [`Load time: ${Math.round(loadTime)}ms`]
      });
      console.log(`✅ Performance test completed: ${Math.round(loadTime)}ms`);
    }
    
    // Security Test
    if (testTypes.includes('security')) {
      console.log('🛡️ Running security test...');
      const isHTTPS = url.startsWith('https://');
      results.push({
        testName: 'Security Test',
        status: isHTTPS ? 'passed' : 'failed',
        score: isHTTPS ? 100 : 50,
        details: [`HTTPS: ${isHTTPS ? 'Enabled' : 'Disabled'}`]
      });
      console.log(`✅ Security test completed: HTTPS ${isHTTPS ? 'OK' : 'Missing'}`);
    }
    
    // Forms Test
    if (testTypes.includes('forms')) {
      console.log('📝 Running forms test...');
      const formCount = await page.locator('form').count();
      results.push({
        testName: 'Forms Test',
        status: formCount > 0 ? 'passed' : 'warning',
        score: formCount > 0 ? 100 : 70,
        details: [`Forms found: ${formCount}`]
      });
      console.log(`✅ Forms test completed: ${formCount} forms found`);
    }
    
    // Links Test
    if (testTypes.includes('links')) {
      console.log('🔗 Running links test...');
      const linkCount = await page.locator('a[href]').count();
      results.push({
        testName: 'Links Test',
        status: linkCount > 0 ? 'passed' : 'warning',
        score: linkCount > 0 ? 100 : 70,
        details: [`Links found: ${linkCount}`]
      });
      console.log(`✅ Links test completed: ${linkCount} links found`);
    }
    
    // SEO Test
    if (testTypes.includes('seo')) {
      console.log('📊 Running SEO test...');
      const title = await page.title();
      const hasTitle = title && title.length > 0;
      results.push({
        testName: 'SEO Test',
        status: hasTitle ? 'passed' : 'failed',
        score: hasTitle ? 100 : 50,
        details: [`Title: ${hasTitle ? 'Present' : 'Missing'}`]
      });
      console.log(`✅ SEO test completed: Title ${hasTitle ? 'OK' : 'Missing'}`);
    }
    
    // Accessibility Test
    if (testTypes.includes('accessibility')) {
      console.log('♿ Running accessibility test...');
      const imgCount = await page.locator('img').count();
      const imgWithAlt = await page.locator('img[alt]').count();
      const altRatio = imgCount > 0 ? (imgWithAlt / imgCount) * 100 : 100;
      
      results.push({
        testName: 'Accessibility Test',
        status: altRatio > 80 ? 'passed' : 'warning',
        score: Math.round(altRatio),
        details: [`Images with alt text: ${imgWithAlt}/${imgCount}`]
      });
      console.log(`✅ Accessibility test completed: ${Math.round(altRatio)}% alt text coverage`);
    }
    
    // Create final report
    const overallScore = Math.round(
      results.reduce((sum, result) => sum + result.score, 0) / results.length
    );
    
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
      timestamp: new Date().toISOString()
    }, null, 2));
    
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
