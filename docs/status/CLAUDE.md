# Status Directory - Claude Code Instructions

This directory contains comprehensive platform status reports for the WARP platform.

## Purpose

Status reports provide point-in-time snapshots of:
- Infrastructure health (GKE, database, services)
- Deployment status (pods, containers, versions)
- Service metrics (traffic, uptime, errors)
- Critical issues and recommendations
- Action items with priority rankings

## Report Generation Guidelines

### When to Generate Reports

1. **Weekly** during active development
2. **After major deployments** (new service, infrastructure change)
3. **After incidents** (post-mortem documentation)
4. **Before major decisions** (baseline state)
5. **Monthly** during stable operation (health check)

### Report Structure

Each status report should include:

1. **Executive Summary**
   - Overall health score (/100)
   - Quick status of all services
   - Critical issues summary
   - Platform uptime

2. **Infrastructure Details**
   - GKE cluster status
   - Node health and resource utilization
   - Network configuration
   - External IPs and load balancers

3. **Service-by-Service Status**
   - Pod counts and health
   - Container versions
   - Resource usage (CPU, memory)
   - Health check status
   - Recent logs sample

4. **Database Status**
   - Connection pool health
   - Schema overview
   - Data statistics (row counts, key tables)
   - Active connections

5. **Critical Findings**
   - Priority-ranked issues (🔴 HIGH, ⚠️ MEDIUM, 🔵 LOW)
   - Root cause analysis
   - Recommended actions with timelines
   - Owner assignments

6. **Next Steps**
   - Week-by-week action plan
   - Testing requirements
   - Documentation needs
   - Production readiness gaps

### Interrogation Commands

Use these commands to gather status information:

```bash
# Kubernetes cluster
kubectl get nodes -o wide
kubectl get pods --all-namespaces
kubectl top nodes
kubectl top pods --all-namespaces

# Specific namespaces
kubectl get all -n warp-api
kubectl get all -n messaging
kubectl get all -n warp-core

# Service details
kubectl describe deployment -n <namespace> <deployment-name>
kubectl logs -n <namespace> <pod-name> --tail=50

# Database
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -U warp_app -d warp -c "
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname IN ('messaging', 'accounts', 'auth', 'voice')
  ORDER BY schemaname, tablename;
"

# Service health checks
kubectl exec -n <namespace> <pod> -- wget -qO- http://localhost:8080/health
curl -s http://<external-ip>/health

# External IPs
kubectl get svc --all-namespaces -o wide | grep LoadBalancer
```

### Naming Convention

```
PLATFORM_STATUS_<YYYY-MM-DD>.md
```

Examples:
- `PLATFORM_STATUS_2025-10-27.md`
- `PLATFORM_STATUS_2025-11-03.md`

### Report History

Maintain chronological history in this directory for:
- Trend analysis (resource growth, error patterns)
- Incident investigation (what changed?)
- Capacity planning (when to scale?)
- Compliance audits (uptime proof)

### Automation Opportunities

Consider creating `scripts/generate-status-report.sh`:

```bash
#!/bin/bash
# Automated status report generation

REPORT_DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="docs/status/PLATFORM_STATUS_${REPORT_DATE}.md"

echo "# WARP Platform Status Report - ${REPORT_DATE}" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Kubernetes status
kubectl get nodes -o wide >> $OUTPUT_FILE

# Service health
for ns in warp-api messaging warp-core; do
  kubectl get pods -n $ns -o wide >> $OUTPUT_FILE
done

# Database stats
PGPASSWORD='...' psql -h ... -c "..." >> $OUTPUT_FILE

echo "Report generated: $OUTPUT_FILE"
```

## Working with Status Reports

### Reviewing Reports

1. **Compare with previous report** - Identify trends
2. **Check critical findings** - Prioritize actions
3. **Verify recommendations** - Execute high-priority items
4. **Update CLAUDE.md** - Reflect current state in project instructions

### Acting on Recommendations

Each recommendation includes:
- **Priority level** (Critical, High, Medium, Low)
- **Estimated effort** (hours/days)
- **Owner** (team/role responsible)
- **Timeline** (when to complete)
- **Success criteria** (how to verify completion)

Create GitHub issues or project board tasks from recommendations.

### Archiving Old Reports

After 90 days, consider archiving old reports:

```bash
mkdir -p docs/status/archive/2025-Q4/
mv docs/status/PLATFORM_STATUS_2025-*.md docs/status/archive/2025-Q4/
```

Keep most recent 12 reports (3 months) in main directory.

## Key Metrics to Track

### Infrastructure
- Node count and resource utilization
- Pod counts per namespace
- Restart counts (should be 0)
- Uptime duration

### Services
- SMPP Gateway: Messages processed, vendor connections
- API Gateway: Request rate, error rate, latency
- Kamailio: Active registrations, call count
- Database: Active connections, query performance

### Business
- Customer count
- DID count (total, active, SMS-enabled)
- Monthly costs (numbers, infrastructure)
- Revenue metrics (if available)

### Operational
- Deployment frequency
- Mean time to recovery (MTTR)
- Incident count
- Support tickets

## Example Status Report Template

See `PLATFORM_STATUS_2025-10-27.md` for a comprehensive example including:

- ✅ All sections filled out
- ✅ Tables with real data
- ✅ Priority-ranked findings
- ✅ Actionable recommendations
- ✅ Week-by-week implementation plan
- ✅ Health score calculation

Use this as a reference for future reports.

---

## Notes for Claude Code

When generating status reports:

1. **Always query live systems** - Don't rely on outdated documentation
2. **Include raw command output** - Provide evidence for findings
3. **Calculate health scores** - Quantify overall platform health
4. **Prioritize findings** - Not all issues are equal
5. **Provide timelines** - Estimate effort for recommendations
6. **Assign owners** - Identify who should act
7. **Define success criteria** - Make outcomes measurable

**Do NOT**:
- ❌ Generate reports without live data
- ❌ Mark issues as resolved without verification
- ❌ Omit critical findings to make status look better
- ❌ Provide recommendations without timelines/effort estimates

**Always**:
- ✅ Be honest about system state (good and bad)
- ✅ Provide actionable next steps
- ✅ Include evidence (logs, metrics, command output)
- ✅ Quantify findings (percentages, counts, durations)

---

**Last Updated**: 2025-10-27
**Next Review**: When new status report is generated
