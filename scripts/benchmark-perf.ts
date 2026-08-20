import { chromium } from 'playwright';

async function runBenchmark() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Starting benchmark...');
  const startTime = Date.now();
  
  // Navigate to localhost
  // Note: Assumes the dev server is running on port 4123 as per vite config
  await page.goto('http://localhost:4123');
  
  const loadTime = Date.now() - startTime;
  
  // Measure FCP (First Contentful Paint)
  const fcp = await page.evaluate(async () => {
    return new Promise((resolve) => {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntriesByName('first-contentful-paint');
        if (entries.length > 0) {
          resolve(entries[0].startTime);
        }
      }).observe({ type: 'paint', buffered: true });
      
      // Fallback if already fired
      setTimeout(() => resolve(0), 3000);
    });
  });

  // Measure LCP (Largest Contentful Paint)
  const lcp = await page.evaluate(async () => {
    return new Promise((resolve) => {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      setTimeout(() => resolve(0), 3000);
    });
  });

  // Check bundle size (approximate by summing JS requests)
  let jsSize = 0;
  page.on('response', async (response) => {
    if (response.request().resourceType() === 'script') {
      try {
        const buffer = await response.body();
        jsSize += buffer.length;
      } catch (e) { console.error("[Swallowed Exception Handled]", e); }
    }
  });

  // Reload to capture resources
  await page.reload();
  await page.waitForLoadState('networkidle');

  console.log('--- Benchmark Results ---');
  console.log(`Load Time: ${loadTime}ms`);
  console.log(`FCP: ${fcp}ms`);
  console.log(`LCP: ${lcp}ms`);
  console.log(`JS Bundle Size (approx dev mode): ${(jsSize / 1024).toFixed(2)} KB`);
  
  await browser.close();
}

runBenchmark().catch(console.error);
