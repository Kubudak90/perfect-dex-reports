# BaseBook DEX — TEKNİK MİMARİ DOKÜMANI

**Temel:** Ekubo EVM Singleton + %50 Gelir Paylaşımı  
**Hedef Chain:** Base (Primary) → Arbitrum, Optimism (Secondary)  
**Ekip:** 7 Kişilik Uzman Kadro  
**Timeline:** 16 Hafta (4 Ay)

---

## 1. GENEL MİMARİ

```
┌─────────────────────────────────────────────────────────────────┐
│                         KULLANICI                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 14 + wagmi v2)                               │
│  - Wallet connection                                            │
│  - Quote request → Backend                                      │
│  - TX signing → Permit2 signature                               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  BACKEND (Node.js)      │     │  RUST ROUTER            │
│  - Fastify API          │────▶│  - Path finding         │
│  - Redis Cache          │     │  - Swap simulation      │
│  - The Graph queries    │     │  - Gas optimization     │
└─────────────────────────┘     └─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN (Base)                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POOL MANAGER (Singleton)                                │   │
│  │  - Flash accounting                                      │   │
│  │  - Internal pool state                                   │   │
│  │  - Hook callbacks                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ SwapRouter   │ │PositionMgr  │ │   Hooks      │           │
│  │ + Permit2    │ │   (NFT)     │ │  (6 adet)    │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  THE GRAPH (Indexer) - Historical data, Analytics               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. EKİP YAPISI

```
PROJE SAHİBİ → CTO/Lead Architect
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
BLOCKCHAIN      BACKEND         FRONTEND
(2 kişi)        (2 kişi)        (1 kişi)
                    ↓
               QA ENGINEER
```

| # | Rol | Ana Sorumluluk | Gerekli Deneyim |
|---|-----|----------------|-----------------|
| 1 | CTO / Lead Architect | Teknik liderlik, mimari kararlar | 5+ yıl eng. management, DeFi |
| 2 | Solidity Lead | Core contracts, audit hazırlığı | Solidity Expert, Foundry, 3+ yıl |
| 3 | Solidity Researcher | 6 Hook geliştirme, MEV araştırması | Solidity İleri, AMM math |
| 4 | Rust Engineer | Smart Router Engine, path finding | Rust 3+ yıl, graph algorithms |
| 5 | Backend Senior | API, Database, Subgraph, WebSocket | Node.js 3+ yıl, PostgreSQL, Redis |
| 6 | Frontend Lead | Next.js UI, wagmi entegrasyonu | React 3+ yıl, wagmi, TailwindCSS |
| 7 | QA Engineer | Test otomasyon, CI/CD, monitoring | Playwright, Docker, CI/CD |

---

## 3. KRİTİK TEKNOLOJİLER

### 3.1 RUST ROUTER (Smart Router Engine)

Kullanıcı "1 ETH → USDC" dediğinde, en iyi fiyatı bulmak için hangi pool'lardan geçmesi gerektiğini hesaplıyor.

**Neden Rust?**
```
JavaScript/Node.js  →  ~50-100ms latency
Rust               →  <10ms latency (5-10x faster)
```

**Bileşenler:**

| Bileşen | Görev |
|---------|-------|
| Pool Graph | Tüm pool'ları graph yapısında tutar (token=node, pool=edge) |
| Path Finder | Dijkstra/A* ile en iyi yolu bulur (max 4 hop) |
| Swap Simulator | Her route için output simülasyonu (tick crossing, fees) |
| Gas Optimizer | Gas maliyetini hesaba katarak net en iyi route |

**Örnek routing:**
```
Direkt:     ETH ──────────────────────────→ USDC
2-hop:      ETH ────→ WBTC ────→ USDC
Split:      %60 ETH → USDC (Pool A)
            %40 ETH → WBTC → USDC (Pool B+C)
```

**Gas-Aware Optimization:**
```
Route A: 1 ETH → 2450 USDC (1 hop, $0.50 gas)  → Net: 2449.50
Route B: 1 ETH → 2455 USDC (3 hop, $2.00 gas)  → Net: 2453.00 ✓
```

---

### 3.2 EKUBO EVM SINGLETON

**Klasik DEX vs Singleton:**

```
KLASİK (Uniswap V2/V3):
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Pool 1  │  │ Pool 2  │  │ Pool 3  │   ← Her pool ayrı kontrat
└─────────┘  └─────────┘  └─────────┘   ← Multi-hop = çoklu external call

SINGLETON (Ekubo):
┌─────────────────────────────────────┐
│           POOL MANAGER              │  ← Tek kontrat
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │Pool 1 │ │Pool 2 │ │Pool 3 │     │  ← Internal state
└─────────────────────────────────────┘  ← Multi-hop = tek TX
```

**Avantajlar:**
- Multi-hop swap'larda **%30-50 gas tasarrufu**
- Flash Accounting: Token transfer sadece başta ve sonda

```
Klasik: Her hop'ta transfer → 4 transfer = 4x gas
Singleton: Sadece delta'lar → 2 transfer = 2x gas
```

---

### 3.3 HOOK SİSTEMİ

Pool'lara custom logic eklemeyi sağlıyor. Her swap/mint/burn öncesi/sonrası hook çağrılıyor.

**BaseBook'un 6 Hook'u:**

| Hook | Ne Yapıyor | Öncelik |
|------|------------|---------|
| **DynamicFeeHook** | Volatilite yüksekken fee artır (LP koruması) | P1 |
| **OracleHook** | TWAP fiyat oracle'ı (manipulation-resistant) | P1 |
| **LimitOrderHook** | On-chain limit order (tick bazlı) | P2 |
| **MEVProtectionHook** | Sandwich attack koruması | P2 |
| **TWAPOrderHook** | Büyük order'ları zamana yay | P3 |
| **AutoCompoundHook** | Fee'leri otomatik LP'ye ekle | P3 |

**DynamicFeeHook mantığı:**
```
Volatilite YÜKSEK  → Fee %1.0
Volatilite ORTA    → Fee %0.5
Volatilite DÜŞÜK   → Fee %0.3 (default)
```

---

### 3.4 PERMIT2

**Problem:** Her token için ayrı `approve()` TX'i gerekiyor.

**Çözüm:** Off-chain imza ile tek seferde approval.

```
Klasik:
1. approve(USDC, Router)  ← 1 TX, gas
2. swap()                 ← 1 TX

Permit2:
1. sign(permit)           ← Off-chain, FREE
2. swap(signature)        ← 1 TX
```

**Avantajlar:**
- Daha az TX, daha az gas
- Expiring approvals (güvenlik)
- Batch permits (birden fazla token tek imzayla)

---

### 3.5 THE GRAPH (Subgraph)

Blockchain event'lerini indexleyip GraphQL ile sorgulanabilir hale getiriyor.

**Neden gerekli?**
- Blockchain'den historical data çekmek yavaş ve pahalı
- Subgraph ile milisaniyeler içinde sonuç

**Indexlenen veriler:**
- Swap'lar (amount, price, timestamp)
- Pool state değişimleri
- Liquidity pozisyonları
- OHLCV chart data
- Protocol analytics

---

### 3.6 WAGMI V2

React için Web3 hook library.

**Temel hook'lar:**
```typescript
useAccount()        // Wallet bağlantı durumu
useBalance()        // Token bakiyesi
useReadContract()   // Contract okuma
useWriteContract()  // Contract yazma
useWaitForTx()      // TX takibi
```

**Avantajlar:**
- Type-safe (TypeScript first)
- Auto-refresh (block değişince)
- Caching
- Multi-chain support
- Wallet agnostic

---

## 4. FRONTEND YAPISI

### 4.1 Proje Yapısı

```
frontend/src/
├── app/           # Next.js App Router
│   ├── swap/      # Swap sayfası
│   ├── pools/     # Pool listesi & detay
│   ├── add/       # Likidite ekleme
│   ├── remove/    # Likidite çıkarma
│   ├── positions/ # Pozisyon yönetimi
│   ├── analytics/ # Analytics dashboard
│   └── portfolio/ # Kullanıcı portföyü
│
├── components/    # UI bileşenleri
│   ├── swap/      # SwapWidget, TokenInput, SwapRoute
│   ├── pool/      # PoolTable, PoolChart, TickChart
│   ├── liquidity/ # RangeSelector, PositionCard
│   └── common/    # TokenLogo, LoadingState
│
├── hooks/         # React hooks
│   ├── swap/      # useSwap, useSwapQuote, useSwapRoute
│   ├── pool/      # usePools, usePool, usePoolTicks
│   ├── liquidity/ # useAddLiquidity, usePositions
│   └── token/     # useToken, useTokenBalance
│
├── stores/        # Zustand state management
│   ├── useSwapStore.ts
│   ├── useSettingsStore.ts
│   └── useTransactionStore.ts
│
└── lib/           # Utilities & config
    ├── constants/ # Addresses, ABIs, chains
    ├── utils/     # Format, math, validation
    └── api/       # Backend API client
```

### 4.2 Kritik Hook'lar

**useSwap:**
```typescript
{
  // State
  tokenIn, tokenOut, amountIn, amountOut
  
  // Quote
  quote, isQuoteLoading, priceImpact
  
  // Execution
  approve(), swap(), isSwapping
  
  // Validation
  canSwap, insufficientBalance, buttonText
}
```

**useAddLiquidity:**
```typescript
{
  // Pool
  token0, token1, feeTier, pool
  
  // Range
  priceLower, priceUpper, inRange
  
  // Amounts
  amount0, amount1, totalValueUsd
  
  // Execution
  addLiquidity(), isAdding
}
```

---

## 5. BACKEND YAPISI

### 5.1 API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/swap/quote` | POST | Swap quote al (Rust Router) |
| `/swap/route` | POST | Detaylı route bilgisi |
| `/pools` | GET | Pool listesi (filtreleme, sıralama) |
| `/pools/:id` | GET | Pool detay + chart data |
| `/pools/:id/ticks` | GET | Tick-bazlı likidite dağılımı |
| `/tokens` | GET | Token listesi |
| `/tokens/:address` | GET | Token detay + fiyat |
| `/positions/:address` | GET | Kullanıcı pozisyonları |
| `/analytics/overview` | GET | Protocol stats |

### 5.2 WebSocket Events

| Event | Yön | Açıklama |
|-------|-----|----------|
| `subscribe:prices` | → | Fiyat stream'e abone ol |
| `price:update` | ← | Fiyat güncellemesi |
| `subscribe:pool` | → | Pool state'e abone ol |
| `pool:update` | ← | Pool değişikliği |
| `tx:confirmed` | ← | TX onaylandı |

---

## 6. VERİTABANI & CACHE

### 6.1 PostgreSQL Schema

| Tablo | Anahtar Alanlar |
|-------|-----------------|
| tokens | address, chain_id, symbol, decimals, price_usd, volume_24h |
| pools | pool_id, token0/1_id, fee_tier, sqrt_price, liquidity, tvl, apr |
| swaps | tx_hash, pool_id, sender, amount0/1, amount_usd, timestamp |
| pool_hour_data | OHLCV, volume, tvl, fees, tx_count |
| user_positions | token_id, owner, pool_id, tick_range, liquidity, unclaimed_fees |

### 6.2 Redis Cache

| Key Pattern | TTL | Kullanım |
|-------------|-----|----------|
| `price:{chainId}:{token}` | 10s | Token fiyatları |
| `pool:{chainId}:{poolId}` | 30s | Pool detayları |
| `pool:state:{chainId}:{poolId}` | 15s | Sık değişen state |
| `route:{in}:{out}:{bucket}` | 15s | Routing cache |
| `quote:{params}` | 10s | Quote cache |
| `user:{addr}:positions` | 30s | Kullanıcı pozisyonları |

---

## 7. SMART CONTRACTS

### 7.1 Kontrat Yapısı

```
contracts/
├── core/
│   ├── PoolManager.sol      # Singleton pool yönetimi
│   ├── Position.sol         # NFT pozisyon
│   └── PoolKey.sol          # Pool identifier
│
├── periphery/
│   ├── SwapRouter.sol       # Swap execution + Permit2
│   ├── PositionManager.sol  # LP NFT mint/burn
│   └── Quoter.sol           # On-chain quote
│
├── hooks/
│   ├── DynamicFeeHook.sol
│   ├── OracleHook.sol
│   ├── LimitOrderHook.sol
│   ├── MEVProtectionHook.sol
│   ├── TWAPOrderHook.sol
│   └── AutoCompoundHook.sol
│
└── libraries/
    ├── TickMath.sol
    ├── SqrtPriceMath.sol
    └── LiquidityMath.sol
```

### 7.2 Fee Yapısı

| Fee Tier | Tick Spacing | Kullanım |
|----------|--------------|----------|
| 0.01% (100) | 1 | Stablecoin pairs |
| 0.05% (500) | 10 | Stable-like pairs |
| 0.30% (3000) | 60 | Most pairs |
| 1.00% (10000) | 200 | Exotic pairs |

---

## 8. GELİŞTİRME TIMELINE (16 Hafta)

### Phase 1: Foundation (Hafta 1-4)
**Hedef:** Testnet'te swap çalışıyor

| Alan | Görevler |
|------|----------|
| Solidity | Ekubo fork → SwapRouter → PositionManager → %80+ coverage |
| Backend | Monorepo → API skeleton → Quote endpoint → Cache/WS |
| Frontend | Next.js/wagmi → TokenSelector → SwapWidget → Full Swap |
| Rust | Setup → Pool graph → Basic routing |

**Milestone:** TESTNET MVP ✓

### Phase 2: Core Features (Hafta 5-8)
**Hedef:** Tüm core özellikler tamamlanmış

| Alan | Görevler |
|------|----------|
| Solidity | DynamicFee/Oracle Hook → LimitOrder → MEVProtection |
| Backend | Position endpoints → Analytics → Full WebSocket |
| Frontend | Add Liquidity → Pool pages → Portfolio → Charts |
| Rust | Multi-hop routing → Split routing → Gas optimization |

**Milestone:** FEATURE COMPLETE ✓

### Phase 3: Polish (Hafta 9-12)
**Hedef:** Production-ready kalite

| Alan | Görevler |
|------|----------|
| Solidity | Gas optimization → Fuzz testing 10K+ → Audit paketi |
| Backend | Rate limiting → Multi-chain → Load testing |
| Frontend | UX polish → Mobile → E2E tests → Performance |
| QA | Full test suite → Bug bash → Pre-launch checklist |

**Milestone:** AUDIT READY ✓

### Phase 4: Launch (Hafta 13-16)
**Hedef:** Mainnet'te canlı

- Hafta 13-14: External audit (Tier 2), mainnet prep
- Hafta 15: Audit fixes, soft launch (whitelist)
- Hafta 16: Final verification, public launch

**Milestone:** PUBLIC LAUNCH 🚀

---

## 9. GÜVENLİK STRATEJİSİ

### 9.1 Güvenlik Katmanları

| Katman | İçerik |
|--------|--------|
| 1. Kod Kalitesi | Solidity 0.8.24+, OpenZeppelin, CEI Pattern, Slither, %95+ coverage |
| 2. Internal Review | 2 onay/PR, security checklist, threat modeling |
| 3. External Audit | Tier 2 audit ($50K), fix, re-audit |
| 4. Post-Launch | Bug bounty (Immunefi), Forta monitoring, emergency pause |

### 9.2 Pre-Deployment Checklist

- [ ] Reentrancy-safe external calls
- [ ] Integer overflow/underflow koruması
- [ ] Access control doğru
- [ ] Front-running koruması
- [ ] Flash loan attack koruması
- [ ] Oracle manipulation koruması
- [ ] Slippage koruması + Deadline
- [ ] Emergency pause fonksiyonu

---

## 10. DEVOPS & ALTYAPI

### 10.1 Production Architecture

```
CLOUDFLARE CDN → LOAD BALANCER
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
FRONTEND          API NODES         WS SERVERS
(Vercel)          (K8s)             (K8s)
                      ↓
         ┌────────────┼────────────┐
         ↓            ↓            ↓
    POSTGRESQL     REDIS      RUST ROUTER
```

### 10.2 CI/CD Pipeline

```
PR/Push → Lint → Type Check → Unit Tests → Build
                                    ↓
                    [develop] → Deploy Staging → E2E
                    [main] → Deploy Production (manual approval)
```

### 10.3 Monitoring Stack

| Tool | Kullanım |
|------|----------|
| Prometheus | Metrics collection |
| Grafana | Visualization |
| Loki | Log aggregation |
| Sentry | Error tracking |
| PagerDuty | Alerting |

---

## 11. TEKNİK STANDARTLAR

### Kod Standartları

| Alan | Standart |
|------|----------|
| Solidity | Style Guide, NatSpec, Foundry, %95+ coverage |
| TypeScript | ESLint+Prettier, JSDoc, Vitest |
| Rust | rustfmt+clippy, doc comments |

### Git Workflow

**Branches:** `main` (prod) → `develop` (integration) → `feature/*`

**Commits:** `<type>(<scope>): <description>`
- Types: feat, fix, docs, refactor, test, chore

**PR:** 2 approvals required, CI passing

---

## 12. BÜTÇE TAHMİNİ

| Kalem | Maliyet |
|-------|---------|
| Ekip (7 kişi x 4 ay) | $140K - $200K |
| Audit (Tier 2) | $50K |
| Infrastructure (4 ay) | $5K |
| Bug Bounty (başlangıç) | $20K |
| **TOPLAM** | **$215K - $275K** |

---

**Doküman Versiyonu:** 2.0  
**Son Güncelleme:** 2024  
**Hazırlayan:** BaseBook Technical Team
