import { FullConfig } from '@playwright/test';

/**
 * Global teardown runs once after all tests
 * Use for:
 * - Cleaning up test data
 * - Stopping mock servers
 * - Generating reports
 * - Cleanup resources
 */
async function globalTeardown(config: FullConfig) {
  console.log('---');
  console.log('🧹 Running global teardown...');

  // Calculate test session duration
  const startTime = process.env.TEST_SESSION_START;
  if (startTime) {
    const start = new Date(startTime);
    const end = new Date();
    const durationMs = end.getTime() - start.getTime();
    const durationSec = Math.round(durationMs / 1000);

    console.log(`⏱️  Test session duration: ${durationSec}s`);
  }

  // Cleanup test data
  console.log('📊 Cleaning up test data...');

  // In a real scenario, you might:
  // - Clear test database
  // - Remove uploaded files
  // - Reset state

  // Cleanup mock wallets
  console.log('💼 Cleaning up test wallets...');

  console.log('✅ Global teardown complete!');
}

export default globalTeardown;
