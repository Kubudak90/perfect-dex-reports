# 🚨 Incident Response Plan

Emergency response procedures for BaseBook DEX security incidents.

## 📞 Emergency Contacts

> **WARNING: ALL CONTACT FIELDS BELOW ARE UNFILLED.**
> These fields MUST be populated with real contact information BEFORE mainnet launch.
> An incident response plan with no reachable contacts is useless during an active exploit.
> Assign an owner and a deadline to complete this section.

**Field format examples:**
- **Name:** `"Jane Smith"` or `"John Doe"`
- **Phone:** `"+1-XXX-XXX-XXXX"` (include country code)
- **Email:** `"name@basebook.xyz"` or `"name@securityfirm.com"`
- **Backup:** Name of the backup person for this role
- **Location / Timezone:** `"US-East / UTC-5"` or `"EU-West / UTC+1"`

### Incident Response Team

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| Incident Commander | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |
| Security Lead | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |
| Smart Contract Lead | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |
| DevOps Lead | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |
| Communications Lead | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |
| Legal Counsel | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. name@basebook.xyz | **[ACTION REQUIRED]** |

### External Contacts

| Organization | Contact | Phone | Email |
|--------------|---------|-------|-------|
| Audit Firm | **[ACTION REQUIRED]** e.g. "Firm Name / Contact Person" | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. contact@auditfirm.com |
| Security Consultant | **[ACTION REQUIRED]** e.g. "Firm Name / Contact Person" | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. contact@securityfirm.com |
| Law Enforcement | **[ACTION REQUIRED]** e.g. "Agency / Officer Name" | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. tip@ic3.gov |
| Insurance | **[ACTION REQUIRED]** e.g. "Provider / Agent Name" | **[ACTION REQUIRED]** e.g. +1-XXX-XXX-XXXX | **[ACTION REQUIRED]** e.g. claims@insurer.com |

### Multi-Sig Signers (Emergency Pause)

1. **[ACTION REQUIRED]** signer name (Location: **[ACTION REQUIRED]** e.g. "US-East / UTC-5")
2. **[ACTION REQUIRED]** signer name (Location: **[ACTION REQUIRED]** e.g. "EU-West / UTC+1")
3. **[ACTION REQUIRED]** signer name (Location: **[ACTION REQUIRED]** e.g. "US-West / UTC-8")
4. **[ACTION REQUIRED]** signer name (Location: **[ACTION REQUIRED]** e.g. "APAC / UTC+9")
5. **[ACTION REQUIRED]** signer name (Location: **[ACTION REQUIRED]** e.g. "US-Central / UTC-6")

**Required Signatures:** 3 of 5

---

## 🎯 Incident Severity Levels

### Critical (P0) - Immediate Response Required

**Examples:**
- Active exploit draining funds
- Smart contract vulnerability being exploited
- Complete system compromise
- Data breach with user funds at risk
- DDoS attack preventing all access

**Response Time:** < 15 minutes
**Escalation:** Immediate to all team + external experts

---

### High (P1) - Urgent Response Required

**Examples:**
- Discovered critical vulnerability (not yet exploited)
- Partial system outage
- Significant transaction failures
- Unusual activity detected
- Backend compromise

**Response Time:** < 1 hour
**Escalation:** Incident Commander + relevant leads

---

### Medium (P2) - Important Response Required

**Examples:**
- Non-critical vulnerability discovered
- Performance degradation
- Minor transaction failures
- Suspicious activity
- API rate limit reached

**Response Time:** < 4 hours
**Escalation:** Relevant team lead

---

### Low (P3) - Standard Response

**Examples:**
- Minor bugs
- UI issues
- Documentation errors
- Low-priority vulnerabilities

**Response Time:** < 24 hours
**Escalation:** Assigned to developer

---

## 🚀 Incident Response Procedures

### Phase 1: Detection & Triage (0-15 min)

#### 1. Incident Detection

**Automated Alerts:**
- [ ] Monitoring alerts (Grafana/Prometheus)
- [ ] Error tracking (Sentry)
- [ ] Transaction monitoring (Forta)
- [ ] Social media monitoring
- [ ] Bug bounty reports

**Manual Detection:**
- [ ] User reports
- [ ] Team observation
- [ ] Security audit findings

#### 2. Initial Assessment

**Questions to Answer:**
- What is happening?
- When did it start?
- What is the impact?
- Is it ongoing?
- Are funds at risk?
- How many users affected?

**Document in Incident Log:**
```
Incident ID: INC-YYYY-MM-DD-NNN
Reported By:
Reported At:
Severity: P0/P1/P2/P3
Type: Exploit/Outage/Vulnerability/Other
Initial Impact Assessment:
```

#### 3. Assemble Response Team

**For P0/P1 Incidents:**
- [ ] Page Incident Commander
- [ ] Page Security Lead
- [ ] Page relevant technical leads
- [ ] Set up war room (Slack/Discord channel)
- [ ] Start incident timeline document

---

### Phase 2: Containment (15-60 min)

#### For Smart Contract Exploits (P0)

**Immediate Actions (Sequential):**

1. **Emergency Pause (< 5 min)**
   ```bash
   # Via multi-sig wallet
   # Function: PoolManager.pause()
   # Requires: 3 of 5 signatures
   ```
   - [ ] Initiate pause transaction
   - [ ] Get 3 signatures ASAP
   - [ ] Confirm pause active on-chain
   - [ ] Verify no new transactions possible

2. **Assess Damage (5-10 min)**
   - [ ] Check total funds lost
   - [ ] Identify affected pools/users
   - [ ] Review exploit transactions
   - [ ] Understand attack vector

3. **Prevent Further Damage (10-20 min)**
   - [ ] Block malicious addresses (if applicable)
   - [ ] Disable affected features only (if partial pause)
   - [ ] Update monitoring alerts

4. **Secure Infrastructure (20-30 min)**
   - [ ] Review API logs for unusual activity
   - [ ] Check for backdoors
   - [ ] Verify no ongoing access
   - [ ] Change credentials if compromised

**Communication (within 30 min):**
- [ ] Brief status update to users
- [ ] "We are aware and investigating"
- [ ] No detailed info yet (avoid helping attacker)

---

#### For Backend Compromises (P0/P1)

**Immediate Actions:**

1. **Isolate Affected Systems**
   - [ ] Take compromised servers offline
   - [ ] Block suspicious IP addresses
   - [ ] Revoke compromised API keys
   - [ ] Force logout all sessions

2. **Assess Access Level**
   - [ ] What systems were accessed?
   - [ ] What data was exposed?
   - [ ] Were private keys accessed?
   - [ ] Database compromised?

3. **Prevent Spread**
   - [ ] Network segmentation
   - [ ] Change all passwords
   - [ ] Rotate all secrets
   - [ ] Update firewall rules

---

#### For DDoS Attacks (P1)

**Immediate Actions:**

1. **Activate DDoS Protection**
   - [ ] Cloudflare "Under Attack" mode
   - [ ] Rate limiting aggressive
   - [ ] Challenge pages for suspicious IPs

2. **Scale Infrastructure**
   - [ ] Increase server capacity
   - [ ] Enable auto-scaling
   - [ ] Add CDN caching

3. **Identify Attack Pattern**
   - [ ] Source IPs
   - [ ] Attack type
   - [ ] Target endpoints

---

### Phase 3: Investigation & Analysis (1-4 hours)

#### Root Cause Analysis

**Questions to Answer:**
- How did the incident occur?
- What vulnerability was exploited?
- When did the vulnerability exist?
- Why wasn't it caught before?
- What is the full extent of damage?

**Gather Evidence:**
- [ ] Transaction hashes
- [ ] Block numbers
- [ ] Timestamps
- [ ] Server logs
- [ ] Error logs
- [ ] Network traffic logs

**Blockchain Analysis:**
```bash
# Analyze exploit transactions
cast tx <tx_hash> --rpc-url <rpc>

# Check contract state
cast call <contract_address> "function()" --rpc-url <rpc>

# Review event logs
cast logs --from-block <start> --to-block <end> --address <contract>
```

**Tools:**
- [ ] Tenderly (transaction debugging)
- [ ] Etherscan (transaction explorer)
- [ ] Dune Analytics (on-chain analysis)
- [ ] Internal monitoring dashboards

---

### Phase 4: Eradication & Recovery (4-24 hours)

#### Fix Development

**For Smart Contract Exploits:**

1. **Develop Fix**
   - [ ] Identify exact vulnerability
   - [ ] Write patch
   - [ ] Write test reproducing exploit
   - [ ] Verify fix prevents exploit

2. **Security Review of Fix**
   - [ ] Internal review (2+ people)
   - [ ] External auditor review (if time permits)
   - [ ] Test on testnet
   - [ ] Verify no new vulnerabilities

3. **Deployment Plan**
   - [ ] If upgradeable: Deploy upgrade
   - [ ] If not upgradeable: Deploy new version
   - [ ] Migration plan for users
   - [ ] Liquidity migration

**For Backend Issues:**

1. **Apply Patches**
   - [ ] Update vulnerable dependencies
   - [ ] Deploy security fixes
   - [ ] Restart services

2. **Verify Fix**
   - [ ] Test in staging
   - [ ] Verify exploit no longer works
   - [ ] Monitor for 1 hour

---

#### Recovery Steps

**Smart Contract Recovery:**

1. **If Paused Protocol:**
   ```bash
   # After fix deployed and verified
   # Function: PoolManager.unpause()
   # Requires: 3 of 5 multi-sig signatures
   ```

2. **Gradual Re-enable**
   - [ ] Enable swaps first (monitor)
   - [ ] Enable add liquidity (monitor)
   - [ ] Enable all features (monitor)
   - [ ] Watch for 24 hours minimum

3. **User Fund Recovery (if applicable)**
   - [ ] Snapshot affected users
   - [ ] Calculate losses
   - [ ] Compensation plan
   - [ ] Execute recovery

**Backend Recovery:**

1. **Restore Service**
   - [ ] Deploy fixed version
   - [ ] Restore from clean backup
   - [ ] Verify integrity
   - [ ] Test all endpoints

2. **Security Hardening**
   - [ ] Apply security patches
   - [ ] Update access controls
   - [ ] Enhance monitoring
   - [ ] Review configurations

---

### Phase 5: Communication (Ongoing)

#### Internal Communication

**War Room Updates (Every 30 min during P0):**
- Current status
- Actions taken
- Next steps
- Blockers

**Stakeholder Briefings:**
- [ ] Investors
- [ ] Partners
- [ ] Board members

---

#### External Communication

**User Communication Timeline:**

**T+0 (Detection):**
```
Title: System Status Update

We are investigating an issue affecting our platform.
As a precautionary measure, we have temporarily paused
certain functions. Your funds are safe. More updates soon.
```

**T+30 min (After containment):**
```
Title: Incident Update #1

We have identified and contained a [type] issue.
No user funds are at risk [or: X amount affected].
We are working on a fix. ETA: X hours.
```

**T+4 hours (After fix):**
```
Title: Incident Resolved

The issue has been resolved.
Impact: [detailed impact]
Actions taken: [summary]
Next steps: [user actions if needed]
Full post-mortem: [timeline]
```

**T+1 week (Post-mortem):**
```
Title: Incident Post-Mortem

Full technical details:
- What happened
- Root cause
- Timeline
- Impact
- Remediation
- Preventive measures
- Compensation (if applicable)
```

---

#### Communication Channels

**Status Updates:**
- Twitter/X: @basebook_dex
- Discord: #announcements
- Website: status.basebook.xyz
- Email: (for critical users)

**Templates:**
- [ ] Incident notification template
- [ ] Update template
- [ ] Resolution template
- [ ] Post-mortem template

---

### Phase 6: Post-Incident Review (1 week)

#### Post-Mortem Document

**Required Sections:**

1. **Executive Summary**
   - What happened (1 paragraph)
   - Impact summary
   - Resolution summary

2. **Timeline**
   - Detection: [timestamp]
   - Triage: [timestamp]
   - Containment: [timestamp]
   - Investigation: [timestamp]
   - Fix deployed: [timestamp]
   - Resolved: [timestamp]

3. **Root Cause**
   - Technical details
   - Contributing factors
   - Why wasn't it caught?

4. **Impact Assessment**
   - Financial impact
   - User impact
   - Reputational impact

5. **Response Evaluation**
   - What went well
   - What could be improved
   - Response time analysis

6. **Action Items**
   - Immediate fixes (done)
   - Short-term improvements (1 month)
   - Long-term changes (3 months)

---

#### Preventive Measures

**Checklist:**
- [ ] Add test case for this vulnerability
- [ ] Add monitoring for this type of incident
- [ ] Update security checklist
- [ ] Train team on lessons learned
- [ ] Update incident response plan
- [ ] Consider additional audits
- [ ] Review similar code patterns

---

## 🛠️ Incident Response Tools

### Essential Tools

**Blockchain Analysis:**
- Tenderly: https://tenderly.co
- Etherscan: https://basescan.org
- Dune Analytics: https://dune.com
- Block Explorer API

**Monitoring:**
- Grafana: Dashboards
- Prometheus: Metrics
- Sentry: Error tracking
- Forta: On-chain monitoring

**Communication:**
- Slack/Discord: War room
- PagerDuty: Alerting
- Statuspage: Status updates
- Email: Critical comms

**Security:**
- Multi-sig wallet UI
- Tenderly alerting
- Forta detection bots
- Custom monitoring scripts

---

### Pre-Deployed Scripts

**Emergency Pause Script:**
```bash
#!/bin/bash
# emergency-pause.sh
# Requires 3 multi-sig signatures

echo "EMERGENCY PAUSE INITIATED"
echo "Timestamp: $(date)"

# Instructions for multi-sig signers
echo "1. Go to: https://multisig.basebook.xyz"
echo "2. Navigate to PoolManager contract"
echo "3. Execute: pause()"
echo "4. Sign transaction"
echo "5. Share transaction hash"

# Monitor pause status
while true; do
  paused=$(cast call $POOL_MANAGER "isPaused()" --rpc-url $RPC_URL)
  echo "Paused: $paused"
  if [ "$paused" == "true" ]; then
    echo "PAUSE CONFIRMED"
    break
  fi
  sleep 10
done
```

**Fund Recovery Script:**
```bash
#!/bin/bash
# fund-recovery.sh
# Recover funds from exploit

# Document affected users and amounts
# Generate recovery transactions
# Submit for multi-sig approval
```

---

## 📊 Incident Metrics

### Response Time Targets

| Severity | Detection | Triage | Containment | Resolution |
|----------|-----------|--------|-------------|------------|
| P0 | < 5 min | < 15 min | < 1 hour | < 24 hours |
| P1 | < 15 min | < 1 hour | < 4 hours | < 48 hours |
| P2 | < 1 hour | < 4 hours | < 24 hours | < 1 week |
| P3 | < 4 hours | < 24 hours | < 1 week | < 2 weeks |

### Historical Incidents

| ID | Date | Severity | Type | Impact | Response Time | Status |
|----|------|----------|------|--------|---------------|--------|
| INC-001 | | | | | | |

---

## ✅ Incident Response Checklist

### Preparation (Before Any Incident)

- [ ] All team members have incident response training
- [ ] Emergency contacts list updated
- [ ] Multi-sig signers can be reached 24/7
- [ ] War room channels set up
- [ ] Communication templates ready
- [ ] Monitoring and alerting configured
- [ ] Emergency scripts tested
- [ ] Insurance policy reviewed
- [ ] Legal counsel on retainer
- [ ] Post-mortem template prepared

### During Incident

- [ ] Incident declared and severity assigned
- [ ] Response team assembled
- [ ] War room activated
- [ ] Initial triage completed
- [ ] Containment actions taken
- [ ] Users notified (appropriate timing)
- [ ] Investigation ongoing
- [ ] Timeline documented
- [ ] Evidence preserved
- [ ] Fix developed and tested
- [ ] Recovery plan executed
- [ ] Resolution confirmed
- [ ] Final user communication sent

### After Incident

- [ ] Post-mortem scheduled (within 1 week)
- [ ] All stakeholders debriefed
- [ ] Action items assigned
- [ ] Preventive measures implemented
- [ ] Incident response plan updated
- [ ] Team trained on lessons learned
- [ ] Compensation executed (if applicable)
- [ ] Public post-mortem published

---

## 🎓 Training & Drills

### Incident Response Drills

**Frequency:** Quarterly

**Scenarios:**
1. Smart contract exploit simulation
2. Backend compromise simulation
3. DDoS attack simulation
4. Multi-sig coordination drill
5. Communication drill

**Evaluation:**
- Response time
- Coordination effectiveness
- Communication clarity
- Decision making
- Tool proficiency

---

## 📞 24/7 On-Call Rotation

**Schedule:**

| Week | Primary | Secondary | Tertiary |
|------|---------|-----------|----------|
| Week 1 | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** |
| Week 2 | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** |
| Week 3 | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** |
| Week 4 | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** | **[ACTION REQUIRED]** |

**On-Call Responsibilities:**
- Respond to alerts within 15 minutes
- Escalate P0/P1 immediately
- Perform initial triage
- Document incident
- Coordinate response

---

**Document Version:** 1.0
**Last Updated:** 2024-02-03
**Last Drill:** **[ACTION REQUIRED]** schedule and record date of first drill
**Next Drill:** **[ACTION REQUIRED]** schedule before mainnet launch
**Next Review:** Monthly or after any incident
