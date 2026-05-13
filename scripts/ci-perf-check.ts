import { chromium } from 'playwright';

const THRESHOLDS = {
  loadTime: 1000, // ms
  fcp: 800,      // ms
  lcp: 1000,     // ms
  bundleSize: 5000 // KB (dev mode is large, adjust for prod)
};

async function runPerfCheck() {
  console.log('Starting CI Performance Check...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:4123');
    const _loadTime = Date.now() - performance.now(); // Approx, or use navigation timing
    
    // Get real timing metrics
    const timing = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const parsedTiming = JSON.parse(timing);
    const pageLoad = parsedTiming.loadEventEnd - parsedTiming.navigationStart;

    const fcp = await page.evaluate(async () => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntriesByName('first-contentful-paint');
          if (entries.length > 0) resolve(entries[0].startTime);
        }).observe({ type: 'paint', buffered: true });
        setTimeout(() => resolve(0), 2000);
      });
    });

    const lcp = await page.evaluate(async () => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 2000);
      });
    });

    console.log(`\nMetrics:`);
    console.log(`- Load Time: ${pageLoad}ms (Threshold: ${THRESHOLDS.loadTime}ms)`);
    console.log(`- FCP: ${fcp}ms (Threshold: ${THRESHOLDS.fcp}ms)`);
    console.log(`- LCP: ${lcp}ms (Threshold: ${THRESHOLDS.lcp}ms)`);

    const errors = [];
    if (pageLoad > THRESHOLDS.loadTime) errors.push(`Load time exceeded: ${pageLoad}ms`);
    if ((fcp as number) > THRESHOLDS.fcp) errors.push(`FCP exceeded: ${fcp}ms`);
    if ((lcp as number) > THRESHOLDS.lcp) errors.push(`LCP exceeded: ${lcp}ms`);

    if (errors.length > 0) {
      console.error('\n[FAIL] Performance Check Failed:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    } else {
      console.log('\n[PASS] Performance Check Passed');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error running check:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPerfCheck();
