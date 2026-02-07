# Test Setup Guide - Quick Configuration

## 📦 Package.json Scripts

### Frontend (frontend/package.json)

Add these scripts to your `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",

    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",

    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:firefox": "playwright test --project=firefox",
    "test:e2e:webkit": "playwright test --project=webkit",
    "test:e2e:mobile": "playwright test --project=\"Mobile Chrome\"",
    "test:e2e:report": "playwright show-report"
  }
}
```

### Backend (backend/package.json)

Add these scripts to your `backend/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",

    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --testPathPattern=unit",
    "test:integration": "vitest run --testPathPattern=integration"
  }
}
```

## 📦 Required Dependencies

### Frontend

```bash
cd frontend

# Playwright
npm install -D @playwright/test

# Vitest (for unit tests)
npm install -D vitest @vitest/ui

# Testing utilities
npm install -D @testing-library/react @testing-library/jest-dom
```

### Backend

```bash
cd backend

# Vitest
npm install -D vitest @vitest/ui

# Coverage
npm install -D @vitest/coverage-v8
```

## ⚙️ Configuration Files

### Playwright Config (frontend/playwright.config.ts)

Already created at: `frontend/playwright.config.ts`

### Vitest Config (backend/vitest.config.ts)

Create if not exists:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        'dist/',
      ],
    },
  },
});
```

## 🔧 TypeScript Configuration

### tsconfig.json (if needed)

Ensure your `tsconfig.json` includes test files:

```json
{
  "compilerOptions": {
    "types": ["node", "@playwright/test", "vitest/globals"]
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ]
}
```

## 🚀 Running Tests

### First Time Setup

```bash
# Install Playwright browsers
cd frontend
npx playwright install

# Verify installation
npx playwright --version
```

### Run Tests

```bash
# Frontend E2E
cd frontend
npm run dev                 # Terminal 1
npm run test:e2e           # Terminal 2

# Backend API
cd backend
npm run test:integration
```

## ✅ Verification Checklist

- [ ] Frontend scripts added to package.json
- [ ] Backend scripts added to package.json
- [ ] Playwright installed (`@playwright/test`)
- [ ] Vitest installed (`vitest`)
- [ ] Playwright browsers installed (`npx playwright install`)
- [ ] Dev server starts (`npm run dev`)
- [ ] E2E tests run (`npm run test:e2e`)
- [ ] API tests run (`npm run test:integration`)
- [ ] Test report generated (`npm run test:e2e:report`)

## 🎯 Quick Test

Run this to verify everything works:

```bash
# Frontend
cd frontend
npm run dev &
sleep 5
npm run test:e2e -- swap.spec.ts --project=chromium
npm run test:e2e:report

# Backend
cd backend
npm run test:integration
```

## 📝 CI/CD Integration

### GitHub Actions (.github/workflows/test.yml)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  frontend-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Install Playwright
        working-directory: frontend
        run: npx playwright install --with-deps

      - name: Run tests
        working-directory: frontend
        run: |
          npm run dev &
          sleep 10
          npm run test:e2e
        env:
          CI: true

      - name: Upload report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/

  backend-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run tests
        working-directory: backend
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/coverage-final.json
```

## 🔍 Troubleshooting

### "playwright not found"

```bash
npm install -D @playwright/test
npx playwright install
```

### "Cannot find module '@playwright/test'"

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Port 3000 already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Tests fail with timeout

Increase timeout in `playwright.config.ts`:

```typescript
export default defineConfig({
  timeout: 120000, // 2 minutes
});
```

## 📚 Additional Resources

- [Playwright Setup](https://playwright.dev/docs/intro)
- [Vitest Setup](https://vitest.dev/guide/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

---

Setup complete! You're ready to run tests.
