# CI/CD Pipeline Documentation

## Overview

BaseBook DEX uses GitHub Actions for continuous integration and deployment. The pipeline ensures code quality, runs comprehensive tests, and automates deployment to staging and production environments.

## Workflows

### 1. Main Pipeline (`.github/workflows/main.yml`)

**Trigger**: Push or PR to `main` or `develop` branches

**Jobs**:

#### Smart Contracts
```yaml
- Install Foundry
- Build contracts
- Run tests
- Generate coverage report
- Generate gas report
```

**Success Criteria**:
- All tests pass
- Coverage > 95%
- Gas usage within limits

#### Backend
```yaml
- Setup Node.js 20
- Install dependencies
- Lint (ESLint)
- Type check (TypeScript)
- Unit tests (Vitest)
- Integration tests
- Build
```

**Services Required**:
- PostgreSQL 15
- Redis 7

**Success Criteria**:
- Lint passes
- Type check passes
- Tests pass with >80% coverage
- Build succeeds

#### Rust Router
```yaml
- Setup Rust 1.75
- Cache dependencies
- Format check (rustfmt)
- Lint (clippy)
- Build release
- Run tests
- Benchmark
```

**Success Criteria**:
- Format check passes
- No clippy warnings
- All tests pass
- Release build succeeds

#### Frontend
```yaml
- Setup Node.js 20
- Install dependencies
- Lint (ESLint)
- Type check (TypeScript)
- Unit tests (Vitest)
- Build (Next.js)
```

**Success Criteria**:
- Lint passes
- Type check passes
- Tests pass with >70% coverage
- Build succeeds

#### Security Scan
```yaml
- Run Trivy vulnerability scanner
- Upload results to GitHub Security
```

**Success Criteria**:
- No critical vulnerabilities
- No high-severity issues in production code

#### Docker Build & Push
```yaml
- Build multi-platform images
- Push to GitHub Container Registry
- Tag with branch name and SHA
```

**Triggers**: Only on push (not PRs)

**Images**:
- `ghcr.io/basebook/backend`
- `ghcr.io/basebook/router`
- `ghcr.io/basebook/frontend`

### 2. E2E Tests (`.github/workflows/e2e.yml`)

**Trigger**:
- Push/PR to main/develop
- Daily at 2 AM UTC (scheduled)

**Steps**:
```yaml
1. Install Playwright browsers
2. Start test stack (docker-compose.test.yml)
3. Wait for services to be ready
4. Run E2E tests
5. Upload Playwright report
6. Cleanup (docker-compose down)
```

**Test Coverage**:
- Critical user journeys (swap, add liquidity, etc.)
- Wallet connection flows
- Error scenarios
- Mobile/Desktop browsers

**Success Criteria**:
- All E2E tests pass
- No flaky tests
- Performance within thresholds

## Branch Strategy

```
main (production)
  ↑
  │ PR + approval
  │
develop (staging)
  ↑
  │ PR + review
  │
feature/xxx
bugfix/xxx
hotfix/xxx
```

### Branch Protection Rules

#### `main` (Production)
- Require PR with 2 approvals
- Require status checks to pass:
  - contracts
  - backend
  - router
  - frontend
  - security
  - e2e
- Require up-to-date branches
- No direct pushes (even admins)
- Require signed commits

#### `develop` (Staging)
- Require PR with 1 approval
- Require status checks to pass (same as main)
- Allow admins to bypass

## Deployment Strategy

### Staging Deployment

**Trigger**: Push to `develop` branch

**Process**:
1. All CI checks pass
2. Build Docker images
3. Push to registry with `develop-<sha>` tag
4. Deploy to staging K8s cluster
5. Run smoke tests
6. Notify team on Slack

**Environment**:
- URL: https://staging.basebook.xyz
- Namespace: `basebook-staging`
- Database: Staging PostgreSQL
- Auto-deploy: Yes

### Production Deployment

**Trigger**: Push to `main` branch (manual approval required)

**Process**:
1. All CI checks pass
2. Create release candidate
3. Request manual approval
4. Build Docker images
5. Push to registry with `main-<sha>` and `latest` tags
6. Deploy to production K8s cluster
7. Run smoke tests
8. Monitor for issues
9. Notify team on Slack

**Environment**:
- URL: https://basebook.xyz
- Namespace: `basebook`
- Database: Production PostgreSQL
- Auto-deploy: No (manual approval)

**Rollback Plan**:
```bash
kubectl rollout undo deployment/backend -n basebook
kubectl rollout undo deployment/router -n basebook
kubectl rollout undo deployment/frontend -n basebook
```

## Environment Variables

### Development
Managed in `.env` files (not committed)

### CI/CD (GitHub Secrets)
```yaml
# AWS
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION

# Container Registry
GHCR_TOKEN

# Database (Staging/Production)
STAGING_DATABASE_URL
PRODUCTION_DATABASE_URL

# Redis
STAGING_REDIS_URL
PRODUCTION_REDIS_URL

# RPC
STAGING_RPC_URL
PRODUCTION_RPC_URL

# Monitoring
SENTRY_DSN
SENTRY_AUTH_TOKEN
CODECOV_TOKEN

# Notifications
SLACK_WEBHOOK_URL
```

### Adding New Secrets
1. Go to GitHub repo settings
2. Secrets and variables > Actions
3. New repository secret
4. Add secret name and value

## Testing Strategy

### Test Pyramid
```
       ╱╲
      ╱  ╲    E2E Tests (Few, Slow, High Confidence)
     ╱────╲
    ╱      ╲  Integration Tests (Some, Medium Speed)
   ╱────────╲
  ╱          ╲ Unit Tests (Many, Fast, Low Level)
 ╱____________╲
```

### Coverage Requirements

| Component  | Unit  | Integration | E2E |
|-----------|-------|-------------|-----|
| Contracts | 95%+  | 100%        | N/A |
| Backend   | 80%+  | All routes  | Key flows |
| Frontend  | 70%+  | Components  | User journeys |
| Router    | 80%+  | N/A         | N/A |

### Test Execution Times

| Test Type      | Expected Duration | Timeout |
|----------------|------------------|---------|
| Contract Tests | < 2 min          | 5 min   |
| Backend Tests  | < 3 min          | 10 min  |
| Router Tests   | < 1 min          | 5 min   |
| Frontend Tests | < 2 min          | 10 min  |
| E2E Tests      | < 10 min         | 30 min  |

## Monitoring & Alerts

### Pipeline Monitoring

**Metrics Tracked**:
- Build success rate
- Test pass rate
- Deployment frequency
- Lead time for changes
- Time to restore service
- Change failure rate

**Dashboards**:
- GitHub Actions insights
- Custom Grafana dashboard

### Alerts

**Slack Notifications**:
- ✅ Build success (develop/main only)
- ❌ Build failure (all branches)
- 🚀 Deployment started
- ✅ Deployment succeeded
- ❌ Deployment failed
- ⚠️ Flaky test detected

**Email Notifications**:
- Production deployment approval requests
- Critical build failures
- Security vulnerabilities detected

## Performance Optimization

### Caching Strategy

#### Dependencies
```yaml
# Node.js
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: 'package-lock.json'

# Rust
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: router
```

#### Docker Layers
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

#### Build Artifacts
```yaml
- uses: actions/upload-artifact@v3
  with:
    name: build-artifacts
    path: dist/
    retention-days: 7
```

### Parallelization

**Jobs run in parallel**:
- contracts
- backend
- router
- frontend
- security

**Total time**: ~5-8 minutes (vs ~20 minutes serial)

### Resource Optimization

**Runner Types**:
- Most jobs: `ubuntu-latest` (2 cores, 7GB RAM)
- Heavy builds: `ubuntu-latest-8-cores` (if needed)

**Job-specific optimizations**:
- Skip tests on docs-only changes
- Skip Docker build on PRs (only on push)
- Conditional E2E tests (not on every commit)

## Troubleshooting

### Common Issues

#### Build Fails on Dependencies
```bash
# Clear npm cache
npm cache clean --force

# Delete lockfile and reinstall
rm package-lock.json
npm install
```

#### Flaky Tests
```yaml
# Add retry logic
- name: Run tests
  run: npm test
  timeout-minutes: 10
  continue-on-error: false
  # Or use jest-retry
```

#### Docker Build Timeout
```yaml
# Increase timeout
- name: Build Docker image
  timeout-minutes: 30
  run: docker build .
```

#### Database Connection Issues
```yaml
# Add wait step
- name: Wait for database
  run: |
    timeout 60 bash -c 'until pg_isready -h localhost -p 5432; do sleep 2; done'
```

### Debug Mode

Enable debug logs:
```yaml
# In workflow file
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

Or via GitHub UI:
1. Go to Actions
2. Re-run jobs
3. Enable debug logging

## Best Practices

### 1. Keep Pipelines Fast
- Use caching aggressively
- Run jobs in parallel
- Skip unnecessary steps
- Use incremental builds

### 2. Fail Fast
- Run linting first
- Run unit tests before integration
- Use strict mode for TypeScript
- Set appropriate timeouts

### 3. Make Builds Reproducible
- Pin dependency versions
- Use lockfiles
- Use consistent Node/Rust versions
- Avoid non-deterministic operations

### 4. Secure Secrets
- Never log secrets
- Use GitHub Secrets, not environment variables
- Rotate secrets regularly
- Use minimal permissions

### 5. Monitor and Improve
- Track build metrics
- Identify and fix flaky tests
- Optimize slow steps
- Review failures regularly

## Maintenance

### Weekly Tasks
- Review failed builds
- Update flaky test list
- Check dependency updates
- Review security alerts

### Monthly Tasks
- Update GitHub Actions versions
- Update base Docker images
- Review and optimize pipeline
- Update documentation

### Quarterly Tasks
- Major dependency updates
- Review and update branch protection rules
- Audit secrets and permissions
- Performance review

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Jest Best Practices](https://jestjs.io/docs/getting-started)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

**Maintained by**: QA Engineering Team
**Last Updated**: 2024-02-03
