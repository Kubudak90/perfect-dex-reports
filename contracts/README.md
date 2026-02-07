# 🦄 BaseBook DEX - Smart Contracts

> **Decentralized Exchange Protocol on Base Chain**
>
> Ekubo EVM Singleton architecture with 50% revenue sharing and innovative hooks system.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Latest-orange)](https://getfoundry.sh/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-178%20Passing-brightgreen)](test/)
[![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)](test/)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contract Addresses](#contract-addresses)
- [Security](#security)
- [Documentation](#documentation)
- [License](#license)

---

## 🎯 Overview

BaseBook DEX is a next-generation decentralized exchange built on Base L2, implementing the Ekubo EVM Singleton pattern with concentrated liquidity (CLMM) and an extensible hooks system.

### Key Highlights

- **🏗️ Architecture**: Ekubo EVM Singleton pattern (gas efficient)
- **💰 Revenue Model**: 50% fee sharing with liquidity providers
- **🎣 Hooks System**: 6 innovative hooks for advanced trading features
- **⚡ Chain**: Optimized for Base L2 (low gas, fast finality)
- **🔒 Security**: Comprehensive security review completed (see [Security](#security))

### Core Features

✅ **Concentrated Liquidity** - Capital efficiency like Uniswap V3
✅ **Dynamic Fees** - Volatility-based fee adjustment
✅ **Limit Orders** - On-chain limit order execution
✅ **TWAP Orders** - Time-weighted average price execution
✅ **MEV Protection** - Sandwich attack prevention
✅ **Auto-Compound** - Automatic LP fee reinvestment
✅ **Oracle Integration** - TWAP price feeds

---

## 🏛️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BaseBook DEX                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────┐    ┌────────────┐    ┌──────────────┐          │
│  │ SwapRouter │───▶│PoolManager│◀───│PositionMgr   │          │
│  └────────────┘    └─────┬──────┘    └──────────────┘          │
│                           │                                       │
│                     ┌─────┴────────┐                            │
│                     ▼              ▼                            │
│              ┌────────────┐  ┌────────────┐                    │
│              │   Hooks    │  │  Libraries │                    │
│              │  System    │  │   (Math)   │                    │
│              └────────────┘  └────────────┘                    │
│                     │                                            │
│      ┌──────────────┼──────────────┐                           │
│      ▼              ▼              ▼                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │ Dynamic  │ │  Limit   │ │   MEV    │                        │
│ │   Fee    │ │  Order   │ │Protection│                        │
│ └──────────┘ └──────────┘ └──────────┘                        │
│      ▼              ▼              ▼                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │  TWAP    │ │  Oracle  │ │   Auto   │                        │
│ │  Order   │ │  (TWAP)  │ │ Compound │                        │
│ └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Contract Structure

```
contracts/
├── src/
│   ├── core/                  # Core protocol contracts
│   │   ├── PoolManager.sol    # Singleton pool manager
│   │   ├── SwapRouter.sol     # Swap execution router
│   │   ├── PositionManager.sol # NFT position manager
│   │   └── Quoter.sol         # Off-chain price quotes
│   ├── hooks/                 # Hook implementations
│   │   ├── BaseHook.sol       # Hook base contract
│   │   ├── DynamicFeeHook.sol # Volatility-based fees
│   │   ├── LimitOrderHook.sol # On-chain limit orders
│   │   ├── MEVProtectionHook.sol # Sandwich protection
│   │   ├── OracleHook.sol     # TWAP oracle
│   │   ├── TWAPOrderHook.sol  # TWAP order execution
│   │   └── AutoCompoundHook.sol # Auto fee compounding
│   ├── libraries/             # Math & utility libraries
│   ├── types/                 # Custom types
│   └── interfaces/            # Contract interfaces
└── test/                      # Comprehensive test suite
    ├── core/                  # Core contract tests
    ├── hooks/                 # Hook contract tests
    ├── integration/           # Integration tests
    └── fuzz/                  # Fuzz tests
```

---

## ⚡ Features

### 1. Concentrated Liquidity Market Maker (CLMM)

Capital-efficient liquidity provision with customizable price ranges.

```solidity
// Provide liquidity in specific price range
positionManager.mint(MintParams({
    poolKey: poolKey,
    tickLower: -600,
    tickUpper: 600,
    amount0Desired: 1000 ether,
    amount1Desired: 1000 ether,
    // ...
}));
```

### 2. Dynamic Fee Adjustment

Fees automatically adjust based on market volatility (0.01% to 1%).

### 3. On-Chain Limit Orders

Place limit orders that execute automatically when price is reached.

### 4. TWAP Order Execution

Split large orders over time to minimize slippage and market impact.

### 5. MEV Protection

Multi-layer protection against sandwich attacks and front-running.

### 6. Auto-Compounding

Automatically reinvest LP fees to maximize returns.

---

## 📋 Prerequisites

### Required Tools

- **Foundry** - Ethereum development toolkit
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

- **Git** - Version control
- **Node.js** - JavaScript runtime (optional)

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/basebook/basebook-dex.git
cd basebook-dex/contracts
```

### 2. Install Dependencies

```bash
forge install
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Compile Contracts

```bash
forge build
```

---

## 🧪 Testing

### Run All Tests

```bash
# Run full test suite
forge test

# Run with verbosity
forge test -vvv

# Generate coverage
forge coverage
```

### Test Statistics

```
Total Tests:       178
Pass Rate:         100% (178/178)
Coverage:          100% (function level)
Execution Time:    ~35ms
```

---

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide.

### Quick Deploy (Testnet)

```bash
forge script script/Deploy.s.sol:Deploy \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    --verify
```

### Deployed Addresses

**Base Sepolia Testnet**:
- PoolManager: `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05`
- SwapRouter: `0xFf438e2d528F55fD1141382D1eB436201552d1A5`
- Quoter: `0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b`
- PositionManager: `0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA`

---

## 🔒 Security

### Security Status

⚠️ **Security Review**: COMPLETED (Internal)

- **Internal Audit**: ✅ Complete (41 findings documented)
- **External Audit**: ⏳ Pending
- **Bug Bounty**: ⏳ Not launched
- **Mainnet Status**: ❌ NOT READY

### Security Reports

- **[SECURITY_FINAL_REPORT.md](SECURITY_FINAL_REPORT.md)** - Comprehensive review
- **[SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)** - Detailed findings
- **[SECURITY_FIXES_REQUIRED.md](SECURITY_FIXES_REQUIRED.md)** - Fix guide

### Reporting Vulnerabilities

- **Email**: security@basebook.dev
- **DO NOT** open public issues for security vulnerabilities

---

## 📚 Documentation

### Main Documentation

- **[README.md](README.md)** - This file
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide
- **[CLAUDE.md](../CLAUDE.md)** - Technical architecture

### Security Documentation

- **[SECURITY_FINAL_REPORT.md](SECURITY_FINAL_REPORT.md)** - Final security review
- **[SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)** - Security summary

### Task Documentation

- **[TASK_15_SUMMARY.md](TASK_15_SUMMARY.md)** - Hooks implementation
- **[TASK_17_MEV_PROTECTION.md](TASK_17_MEV_PROTECTION.md)** - MEV protection
- **[TASK_18_HOOK_INTEGRATION.md](TASK_18_HOOK_INTEGRATION.md)** - Integration tests
- **[TASK_51_SUMMARY.md](TASK_51_SUMMARY.md)** - TWAP & Auto-compound

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

- **CTO / Lead Architect** - Technical leadership
- **Solidity Lead** - Core contracts & security
- **Solidity Researcher** - Hook development
- **Rust Engineer** - Smart router engine
- **Backend Senior** - API & infrastructure
- **Frontend Lead** - UI/UX
- **QA Engineer** - Testing & DevOps

---

## 📞 Contact

- **General**: hello@basebook.dev
- **Security**: security@basebook.dev
- **Support**: support@basebook.dev

---

## ⚠️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty. See security reports before mainnet use.

- **Not Production Ready**: Security fixes required
- **Experimental**: Hooks are innovative but unproven
- **No Investment Advice**: Not financial advice
- **DYOR**: Understand risks before using

---

**Built with ❤️ by the BaseBook Team**

*Last updated: 2026-02-03*
