import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup runs once before all tests
 * Use for:
 * - Starting test database
 * - Starting mock servers
 * - Initializing test data
 * - Setting up authentication
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Running global setup...');

  // Check if backend is running
  const baseURL = config.use?.baseURL || 'http://localhost:3000';

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Try to reach the application
    await page.goto(baseURL, { timeout: 10000 });
    console.log(`✅ Application is running at ${baseURL}`);

    await browser.close();
  } catch (error) {
    console.error(`❌ Failed to connect to application at ${baseURL}`);
    console.error('Make sure the development server is running:');
    console.error('  npm run dev');
    throw error;
  }

  // Setup test wallets
  console.log('💼 Setting up test wallets...');

  // In a real scenario, you might:
  // - Deploy test contracts to a local fork
  // - Fund test accounts
  // - Setup test data in database

  // Setup mock data
  console.log('📊 Setting up mock data...');

  // Store setup timestamp
  process.env.TEST_SESSION_START = new Date().toISOString();

  console.log('✅ Global setup complete!');
  console.log('---');
}

export default globalSetup;
