# Client Deployment Checklist - OCI
## Information Required for Oracle Cloud Infrastructure Production Deployment

Please provide the following information to proceed with production deployment:

---

## ✅ Required Information

### 1. Domain & DNS
- [ ] **Production Domain Name**: _________________________
  - Example: `carbidding.com` or `app.carbidding.com`
- [ ] **Domain Registrar**: _________________________
  - Example: GoDaddy, Namecheap, OCI DNS
- [ ] **Do you have DNS access?** ☐ Yes ☐ No
- [ ] **Preferred Subdomain**: _________________________
  - Example: `www.carbidding.com` or `app.carbidding.com`

### 2. Supabase Configuration
- [ ] **Supabase Project URL**: _________________________
  - Format: `https://xxxxx.supabase.co`
  - Location: Supabase Dashboard → Settings → API
- [ ] **Supabase Anon Key**: _________________________
  - Location: Supabase Dashboard → Settings → API → "anon public" key
- [ ] **Supabase Project Region**: _________________________
  - Example: `us-east-1`, `eu-west-1`

**How to find Supabase credentials:**
1. Log in to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Copy the values listed above

### 3. OCI Account
- [ ] **OCI Tenancy OCID**: _________________________
  - Location: OCI Console → Administration → Tenancy Details
- [ ] **OCI User OCID**: _________________________
  - Location: OCI Console → Identity → Users
- [ ] **Preferred OCI Region**: _________________________
  - Example: `us-ashburn-1` (US East), `eu-frankfurt-1` (Europe), `ap-sydney-1` (Asia Pacific)
- [ ] **Compartment Name**: _________________________
  - Where resources will be created (or we'll create one)
- [ ] **Monthly Budget Limit**: $ _________________________
  - Estimated cost: $0-30/month (generous free tier available)

### 4. Application Configuration
- [ ] **Default Admin Email**: _________________________
  - Example: `admin@carbidding.com`
- [ ] **Default Admin Password**: _________________________
  - ⚠️ Will need to be changed on first login
- [ ] **Production Environment Name**: _________________________
  - Example: `production`, `prod`, `live`

### 5. Deployment Method Preference
- [ ] **Option 1: Object Storage + CDN** (Recommended - Most Cost-Effective)
  - Best for: Static sites, low cost ($0-5/month)
  - Pros: Very cheap, scalable, CDN included
  - Cons: Less control, no server-side features
  
- [ ] **Option 2: Compute Instance + Nginx** (Full Control)
  - Best for: Custom configurations, server-side features
  - Pros: Full control, Always Free tier available
  - Cons: Requires server management
  
- [ ] **Option 3: Container Engine (OKE)** (Advanced)
  - Best for: Containerized apps, auto-scaling
  - Pros: Auto-scaling, modern deployment
  - Cons: More complex, higher cost

### 6. Access & Permissions
- [ ] **OCI Console Access**: ☐ Yes ☐ No
  - If yes, provide access or we'll use our OCI account
- [ ] **Supabase Dashboard Access**: ☐ Yes ☐ No
  - If yes, provide login credentials
- [ ] **Git Repository Access**: ☐ Yes ☐ No
  - For automatic deployments (if using CI/CD)
- [ ] **SSH Key Access**: ☐ Yes ☐ No
  - If using Compute Instance, we'll need SSH access

---

## 📋 Optional Information

### Custom Email/SMS (if applicable)
- [ ] **Email Service Provider**: _________________________
- [ ] **SMS Service Provider**: _________________________

### Compliance & Security
- [ ] **Compliance Requirements**: _________________________
  - Example: GDPR, HIPAA, PCI-DSS
- [ ] **Backup Requirements**: _________________________
  - Example: Daily, Weekly, Monthly
- [ ] **Monitoring Requirements**: _________________________
  - Example: Uptime monitoring, Error tracking
- [ ] **SSL Certificate Preference**: 
  - ☐ Let's Encrypt (Free, auto-renewal)
  - ☐ OCI Certificate Manager
  - ☐ Custom certificate

---

## 🚀 Deployment Timeline

**Estimated Time**: 2-4 hours

**Steps**:
1. ✅ Information Collection (30 min)
2. ✅ OCI Setup (30-60 min)
3. ✅ Domain Configuration (30-60 min)
4. ✅ Testing & Verification (60-90 min)
5. ✅ Documentation Handover (30 min)

---

## 💰 Cost Estimation

### Option 1: Object Storage + CDN
- **Free Tier**: 10 GB storage, 10 TB CDN egress/month
- **After Free Tier**: ~$0-5/month for small to medium traffic
- **Best For**: Cost-conscious deployments

### Option 2: Compute Instance
- **Always Free Tier**: VM.Standard.E2.1.Micro (up to 2 instances)
- **Paid Option**: VM.Standard.E2.1 (~$30/month)
- **Best For**: Full control, custom configurations

### Option 3: Container Engine (OKE)
- **Control Plane**: Free
- **Worker Nodes**: Same as Compute instances
- **Load Balancer**: ~$15/month
- **Best For**: Containerized, scalable deployments

**Note**: OCI offers one of the most generous free tiers in cloud providers!

---

## 📞 Contact Information

**For Questions or Issues:**
- Email: _________________________
- Phone: _________________________
- Preferred Contact Method: _________________________

---

## 📝 Notes

**Additional Requirements or Special Instructions:**

_________________________________________________________
_________________________________________________________
_________________________________________________________

---

## 🔍 OCI Account Setup (If Needed)

If you don't have an OCI account yet:

1. **Sign Up**: Go to https://cloud.oracle.com
2. **Free Tier**: Includes:
   - 2 Always Free Compute instances
   - 10 GB Object Storage
   - 10 TB CDN egress/month
   - And more!
3. **Verification**: Credit card required (won't be charged for free tier)
4. **Account Setup**: Takes 5-10 minutes

---

**Date**: _______________  
**Client Name**: _______________  
**Prepared By**: _______________


