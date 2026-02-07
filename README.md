# BaseBook DEX

A next-generation decentralized exchange built on Base, powered by Ekubo EVM Singleton architecture.

[![CI](https://github.com/basebook/basebook-dex/workflows/CI/badge.svg)](https://github.com/basebook/basebook-dex/actions)
[![Coverage](https://codecov.io/gh/basebook/basebook-dex/branch/main/graph/badge.svg)](https://codecov.io/gh/basebook/basebook-dex)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- 🚀 **High Performance**: Rust-powered routing engine for optimal swap paths
- 💧 **Concentrated Liquidity**: Uniswap v3-style liquidity provision
- 🎣 **Modular Hooks**: 6 custom hooks for advanced trading features
- 💰 **Revenue Sharing**: 50% fee distribution to liquidity providers
- 🔒 **Security First**: Comprehensive testing and external audits
- 📊 **Real-time Analytics**: Advanced charts and portfolio tracking

## Quick Start

### Prerequisites
- Docker 24.0+
- Docker Compose 2.20+
- Node.js 20+ (optional, for local development)

### Start Development Environment

```bash
# Clone repository
git clone https://github.com/basebook/basebook-dex.git
cd basebook-dex

# Copy environment file
cp .env.example .env

# Start all services
./scripts/docker-up.sh
```

Visit http://localhost:3000 to see the frontend.

## Documentation

- **[Docker & Local Development](DOCKER.md)** - Complete Docker setup and development guide
- **[CI/CD Pipeline](CI-CD.md)** - GitHub Actions and deployment documentation
- **[Architecture](CLAUDE.md)** - Technical architecture and design decisions
- **[API Documentation](backend/README.md)** - Backend API reference
- **[Frontend Guide](frontend/README.md)** - Frontend development guide

## Project Structure

```
basebook-dex/
├── contracts/          # Smart contracts (Solidity + Foundry)
├── backend/           # API server (Node.js + TypeScript)
├── router/            # Routing engine (Rust)
├── frontend/          # Web application (Next.js)
├── monitoring/        # Prometheus & Grafana configs
├── scripts/           # Helper scripts
├── .github/           # GitHub Actions workflows
└── docker-compose.yml # Docker Compose configuration
```

## Technology Stack

### Smart Contracts
- Solidity 0.8.24
- Foundry
- OpenZeppelin
- Permit2

### Backend
- Node.js 20
- TypeScript
- Fastify
- Drizzle ORM
- PostgreSQL
- Redis
- The Graph

### Router
- Rust 1.75
- Tokio (async runtime)
- Graph algorithms

### Frontend
- Next.js 14
- React 18
- TypeScript
- TailwindCSS
- wagmi v2
- viem

## Development

### Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Router
cd router && cargo build
```

### Run Tests

```bash
# Smart contracts
cd contracts && forge test

# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Router
cd router && cargo test

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Lint all code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Deployment

### Staging
Automatically deployed on push to `develop` branch.
- URL: https://staging.basebook.xyz

### Production
Manually deployed after approval on push to `main` branch.
- URL: https://basebook.xyz

See [CI-CD.md](CI-CD.md) for detailed deployment instructions.

## Architecture

BaseBook DEX uses a modern, microservices-based architecture:

```
┌─────────────┐
│   Frontend  │  Next.js 14 + wagmi
│   (Port 3000)│
└──────┬──────┘
       │
┌──────▼──────┐
│  Backend API │  Node.js + Fastify
│  (Port 4000) │
└──────┬──────┘
       │
       ├─────────┐
       │         │
┌──────▼────┐ ┌─▼────────┐
│   Router  │ │The Graph │
│   (Rust)  │ │ Indexer  │
│(Port 8080)│ │(Port 8000)│
└───────────┘ └──────────┘
       │
┌──────▼──────┐
│  PostgreSQL │
│    Redis    │
└─────────────┘
```

## Monitoring

Access monitoring dashboards:
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Security

### Audits
- **Cyfrin**: Core contracts (Q1 2024)
- **Trail of Bits**: Full protocol (Q2 2024)

### Bug Bounty
We offer rewards for responsible disclosure of security vulnerabilities.
See [SECURITY.md](SECURITY.md) for details.

### Responsible Disclosure
Email: security@basebook.xyz

## Team

- **Product Owner**: Vision & Strategy
- **CTO**: Technical Leadership
- **Solidity Lead**: Smart Contracts
- **Solidity Researcher**: Hook Development
- **Rust Engineer**: Routing Engine
- **Backend Senior**: API & Infrastructure
- **Frontend Lead**: Web Application
- **QA Engineer**: Testing & DevOps

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **Website**: https://basebook.xyz
- **Documentation**: https://docs.basebook.xyz
- **Twitter**: https://twitter.com/basebook_dex
- **Discord**: https://discord.gg/basebook
- **GitHub**: https://github.com/basebook

## Acknowledgments

Built with inspiration from:
- [Ekubo Protocol](https://ekubo.org)
- [Uniswap v3/v4](https://uniswap.org)
- [The Graph](https://thegraph.com)

---

Made with ❤️ by the BaseBook Team
