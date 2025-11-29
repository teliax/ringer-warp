# Gandi DNS Management Guide

## Overview
We use Gandi LiveDNS API to manage DNS records for the RNS (Ringer Network Solutions) subdomains under `ringer.tel`.

**Current DNS Setup:**
- `api.rns.ringer.tel` → API Gateway (34.58.150.254)
- `admin.rns.ringer.tel` → Vercel (admin portal)
- `console.rns.ringer.tel` → Vercel (customer portal)

---

## Creating a Personal Access Token (PAT)

### 1. Login to Gandi
Go to https://admin.gandi.net

### 2. Generate PAT
1. Navigate to **User Settings** → **Security**
2. Click **"Create a token"** or **"Personal Access Token (PAT)"**
3. Name: `WARP Platform DNS Management`
4. **Required permissions:**
   - ✅ **See and renew domain names**
   - ✅ **Manage domain name technical configurations**
   - ✅ Purchase, renew, and manage certificates (optional)
5. Click **"Create"**
6. **IMPORTANT**: Copy the token immediately (shown only once)

### 3. Test the PAT
```bash
# IMPORTANT: PATs use "Bearer" not "Apikey"!
curl -H "Authorization: Bearer YOUR_PAT_TOKEN" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel

# Should return domain info if successful
```

---

## Storing the PAT Securely

### ✅ Already Stored
```bash
# Google Secret Manager
gcloud secrets versions access latest --secret=gandi-api-key
# Returns: adcaffccd7cb3c689cd49976b2a99cc3e261a2d5

# Kubernetes
kubectl get secret gandi-api-credentials -n warp-api
```

---

## Creating DNS Records

### Create A Record
```bash
curl -X PUT "https://api.gandi.net/v5/livedns/domains/ringer.tel/records/{name}/A" \
  -H "Authorization: Bearer adcaffccd7cb3c689cd49976b2a99cc3e261a2d5" \
  -H "Content-Type: application/json" \
  -d '{"rrset_ttl": 300, "rrset_values": ["YOUR_IP"]}'
```

### Create CNAME Record
```bash
curl -X PUT "https://api.gandi.net/v5/livedns/domains/ringer.tel/records/{name}/CNAME" \
  -H "Authorization: Bearer adcaffccd7cb3c689cd49976b2a99cc3e261a2d5" \
  -H "Content-Type: application/json" \
  -d '{"rrset_ttl": 300, "rrset_values": ["target.domain.com."]}'
```

### List All Records
```bash
curl -H "Authorization: Bearer adcaffccd7cb3c689cd49976b2a99cc3e261a2d5" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel/records
```

---

## RNS Subdomain Structure

All WARP platform services use the `rns.ringer.tel` subdomain:

| Subdomain | Type | Target | Purpose |
|-----------|------|--------|---------|
| `api.rns.ringer.tel` | A | 34.58.150.254 | API Gateway (GKE LoadBalancer) |
| `admin.rns.ringer.tel` | CNAME | cname.vercel-dns.com | Admin Portal (Vercel) |
| `console.rns.ringer.tel` | CNAME | cname.vercel-dns.com | Customer Portal (Vercel) |

---

## Important Notes

### ⚠️ Authentication Change
- **PATs use `Bearer`** scheme (not `Apikey`)
- **API Keys use `Apikey`** scheme (deprecated)
- Your token `adcaffccd7cb3c689cd49976b2a99cc3e261a2d5` is a PAT

### API Rate Limits
- 300 requests per minute
- DNS propagation: ~5 minutes globally
- Batch operations when possible

### Troubleshooting

**403 Forbidden:**
- Verify using `Bearer` not `Apikey`
- Check token hasn't expired
- Confirm permissions include "Manage domain name technical configurations"

**401 Unauthorized:**
- Token is invalid or malformed
- Check copy/paste errors

---

## Reference Documentation
- [Gandi Authentication Docs](https://api.gandi.net/docs/authentication/)
- [Gandi LiveDNS API](https://api.gandi.net/docs/livedns/)

---

**Last Updated:** October 11, 2025  
**Current PAT:** Stored in Google Secret Manager (`gandi-api-key`) and Kubernetes (`gandi-api-credentials`)