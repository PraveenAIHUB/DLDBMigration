# Quick Response to Client Questions

## 1. Can we host this in OCI and approximate cost?

**✅ Yes, OCI is perfect for this application.**

**Cost:**
- **$0/month** (using OCI Always Free tier - sufficient for small to medium traffic)
- **$2-8/month** if traffic grows beyond free tier
- Free tier includes: 10 GB storage, 10 TB CDN traffic, 10,000 requests/month

**Recommendation:** Start with OCI Object Storage + CDN (serverless, no servers to manage)

---

## 2. Infrastructure details - instances, servers, configuration

**Recommended Setup (Object Storage + CDN):**
- **Servers:** 0 (serverless)
- **Compute Instances:** 0
- **Storage:** 1 Object Storage bucket (~500 MB - 2 GB)
- **CDN:** 1 CDN distribution
- **DNS:** 1 CNAME record

**Alternative (Compute Instance):**
- **Servers:** 1 instance (VM.Standard.E2.1.Micro - free tier)
- **CPU:** 1/8 OCPU
- **RAM:** 1 GB
- **Storage:** 50 GB
- **Cost:** $0/month (free tier) or $30/month (paid)

**Configuration:** Static React app hosted on OCI, database on Supabase (external)

---

## 3. Can we host as sub-domain of diamondlease.com?

**✅ Yes, absolutely!**

- You can use `app.diamondlease.com` (or any sub-domain)
- Works perfectly even if main website is hosted elsewhere
- Just add a CNAME or A record in DNS pointing to OCI
- Standard practice, no issues

**Example:**
- `diamondlease.com` → Your current hosting
- `app.diamondlease.com` → OCI (Car Bidding Platform)

---

## 4. SSL Certificate - EV SSL vs DV SSL

**✅ Both options work perfectly!**

**Option A: Add to existing EV SSL**
- If your multi-domain EV SSL supports adding sub-domains
- Usually takes 1-3 business days to reissue
- No additional cost if sub-domains are included

**Option B: Separate DV SSL (Recommended)**
- Use Let's Encrypt (free, automatic renewal)
- Can be set up in 15-20 minutes
- No impact on existing certificate
- Works perfectly with OCI

**Recommendation:** Use Let's Encrypt DV SSL for quick setup (free, 15-20 minutes)

---

## Summary

- **Hosting:** OCI Object Storage + CDN
- **Cost:** $0/month (free tier) or $2-8/month
- **Infrastructure:** 0 servers, 1 bucket, 1 CDN
- **Sub-domain:** ✅ Yes, `app.diamondlease.com` works perfectly
- **SSL:** Let's Encrypt recommended (free, quick setup)

**Timeline:** 1-2 business days for complete deployment


