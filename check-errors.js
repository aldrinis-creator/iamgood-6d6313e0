import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]:`, msg.text());
  });
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    console.log('STACK:', error.stack);
  });
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  try {
    console.log('Navigating to http://localhost:4175/ ...');
    await page.goto('http://localhost:4175/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('Page loaded successfully');
    const content = await page.content();
    console.log('PAGE CONTENT LENGTH:', content.length);
    console.log('BODY:', await page.innerHTML('body'));
  } catch (err) {
    console.log('Navigation error:', err.message);
  }

  await browser.close();
})();
