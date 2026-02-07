# 🔒 Security Quick Reference Guide

Fast access to critical security information.

## 🚨 Emergency Contacts

| Role | Contact | Phone |
|------|---------|-------|
| **Incident Commander** | ________ | ________ |
| **Security Lead** | ________ | ________ |
| **CTO** | ________ | ________ |
| **Multi-Sig Signer 1** | ________ | ________ |
| **Multi-Sig Signer 2** | ________ | ________ |
| **Multi-Sig Signer 3** | ________ | ________ |

**Security Hotline:** __________ (24/7)
**Security Email:** security@basebook.xyz

---

## 🚨 Emergency Procedures

### Protocol Pause (Critical)

**When to Pause:**
- Active exploit
- Funds at risk
- Critical vulnerability discovered
- Unusual activity confirmed

**How to Pause:**
1. Alert all multi-sig signers immediately
2. Go to: https://multisig.basebook.xyz
3. Execute: `PoolManager.pause()`
4. Get 3 signatures ASAP
5. Verify pause active on-chain

**Response Time Target:** < 15 minutes

---

### Incident Declaration

**Severity Levels:**
- **P0 (Critical):** Funds at risk, active exploit
- **P1 (High):** Critical vulnerability, significant issue
- **P2 (Medium):** Important issue, degraded service
- **P3 (Low):** Minor issue

**First Steps:**
1. Assess severity (P0/P1/P2/P3)
2. Alert Incident Commander
3. Create war room (Slack/Discord)
4. Start incident log
5. Begin containment

---

## 📋 Quick Checklists

### Daily Security Checks (5 min)

- [ ] Check monitoring dashboards
- [ ] Review error logs (any spikes?)
- [ ] Check transaction success rate (>98%)
- [ ] Review failed transactions
- [ ] Check for alerts

### Weekly Security Checks (30 min)

- [ ] Run npm audit (frontend + backend)
- [ ] Review access logs
- [ ] Check dependency updates
- [ ] Review user reports
- [ ] Update security metrics
- [ ] Check SSL certificate expiry

### Monthly Security Checks (2 hours)

- [ ] Full security checklist review
- [ ] Access control review
- [ ] Password/key rotation
- [ ] Incident response drill
- [ ] Update documentation
- [ ] Security training session

---

## 🔍 Common Security Issues

### Issue: High Failed Transaction Rate

**Check:**
1. Error logs for patterns
2. Gas prices (too low?)
3. Slippage issues
4. Contract state (paused?)
5. RPC provider status

**Action:**
- If exploit: PAUSE immediately
- If gas: Update gas oracle
- If RPC: Switch provider
- If slippage: Adjust defaults

---

### Issue: Unusual Activity Detected

**Check:**
1. Transaction volume spike
2. Large single transactions
3. Repeated failed attempts
4. Unusual contract interactions
5. Suspicious addresses

**Action:**
- If suspicious: Monitor closely
- If clearly malicious: Consider pause
- Document everything
- Alert security team

---

### Issue: API Error Spike

**Check:**
1. What endpoints?
2. What errors?
3. DDoS attack?
4. Legitimate traffic?
5. Rate limiting working?

**Action:**
- Enable aggressive rate limiting
- Block suspicious IPs
- Scale infrastructure
- Investigate root cause

---

## 🛠️ Security Tools

### Smart Contract Analysis

```bash
# Slither analysis
slither . --detect all

# Mythril analysis
myth analyze contracts/PoolManager.sol

# Test coverage
forge coverage
```

### Dependency Scanning

```bash
# Frontend
cd frontend && npm audit

# Backend
cd backend && npm audit

# Fix vulnerabilities
npm audit fix
```

### SSL/TLS Check

```bash
# Check SSL Labs rating
https://www.ssllabs.com/ssltest/analyze.html?d=basebook.xyz

# Check certificate expiry
echo | openssl s_client -connect basebook.xyz:443 2>/dev/null | openssl x509 -noout -dates
```

### Secret Scanning

```bash
# Scan for secrets in git history
git secrets --scan-history

# Scan with trufflehog
trufflehog git file://.
```

---

## 📊 Security Metrics

### Key Metrics to Monitor

| Metric | Target | Alert If |
|--------|--------|----------|
| Transaction Success Rate | >98% | <95% |
| API Error Rate | <1% | >5% |
| Response Time P95 | <2s | >5s |
| Failed Auth Attempts | <10/hour | >100/hour |
| Rate Limit Hits | <5% | >20% |

### Dashboard Links

- Grafana: https://monitoring.basebook.xyz
- Sentry: https://sentry.io/basebook
- Status Page: https://status.basebook.xyz

---

## 🔐 Common Commands

### Check Contract Status

```bash
# Is paused?
cast call $POOL_MANAGER "isPaused()" --rpc-url $RPC_URL

# Get owner
cast call $POOL_MANAGER "owner()" --rpc-url $RPC_URL

# Get protocol fee
cast call $POOL_MANAGER "protocolFee()" --rpc-url $RPC_URL
```

### Check Transaction

```bash
# Get transaction details
cast tx <tx_hash> --rpc-url $RPC_URL

# Trace transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Debug on Tenderly
tenderly tx <tx_hash>
```

### Check Balances

```bash
# Contract ETH balance
cast balance <address> --rpc-url $RPC_URL

# Token balance
cast call <token> "balanceOf(address)" <address> --rpc-url $RPC_URL
```

---

## 🐛 Bug Bounty Quick Info

**Platform:** Immunefi
**URL:** https://immunefi.com/basebook

**Rewards:**
- Critical: $50K - $250K
- High: $10K - $50K
- Medium: $2K - $10K
- Low: $500 - $2K

**Report:** security@basebook.xyz

---

## 📚 Documentation Links

- [Full Security Checklist](./SECURITY-CHECKLIST.md)
- [Incident Response Plan](./INCIDENT-RESPONSE-PLAN.md)
- [Security Policy](./SECURITY.md)
- [Contract Security](./contracts/SECURITY-VERIFICATION.md)
- [Launch Readiness](./SECURITY-LAUNCH-READY.md)

---

## ✅ Pre-Deploy Checklist

Before deploying to mainnet:

- [ ] All tests passing
- [ ] External audit complete
- [ ] All critical findings fixed
- [ ] Multi-sig configured
- [ ] Emergency procedures tested
- [ ] Monitoring configured
- [ ] Team briefed
- [ ] Communication ready

---

## 🎓 Security Principles

### Remember:

1. **Defense in Depth** - Multiple security layers
2. **Principle of Least Privilege** - Minimal access needed
3. **Fail Securely** - Errors should not compromise security
4. **Trust but Verify** - Validate everything
5. **Keep it Simple** - Complexity is the enemy of security

### When in Doubt:

1. **Pause and Assess** - Don't rush decisions
2. **Consult the Team** - Two heads better than one
3. **Document Everything** - Maintain audit trail
4. **Communicate Clearly** - Keep stakeholders informed
5. **Learn and Improve** - Every incident is a lesson

---

**Keep This Guide Handy!**

Print it, bookmark it, memorize the emergency contacts.

Security is everyone's responsibility.

---

**Last Updated:** 2024-02-03
**Version:** 1.0
