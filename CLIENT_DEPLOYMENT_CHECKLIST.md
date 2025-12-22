# Client Deployment Checklist
## Information Required for AWS Production Deployment

Please provide the following information to proceed with production deployment:

---

## ✅ Required Information

### 1. Domain & DNS
- [ ] **Production Domain Name**: _________________________
  - Example: `carbidding.com` or `app.carbidding.com`
- [ ] **Domain Registrar**: _________________________
  - Example: GoDaddy, Namecheap, AWS Route 53
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

### 3. AWS Account
- [ ] **AWS Account ID**: _________________________
- [ ] **Preferred AWS Region**: _________________________
  - Example: `us-east-1` (recommended), `eu-west-1`
- [ ] **Monthly Budget Limit**: $ _________________________
  - Estimated cost: $5-20/month for small to medium traffic

### 4. Application Configuration
- [ ] **Default Admin Email**: _________________________
  - Example: `admin@carbidding.com`
- [ ] **Default Admin Password**: _________________________
  - ⚠️ Will need to be changed on first login
- [ ] **Production Environment Name**: _________________________
  - Example: `production`, `prod`, `live`

### 5. Access & Permissions
- [ ] **AWS Console Access**: ☐ Yes ☐ No
  - If yes, provide access or we'll use our AWS account
- [ ] **Supabase Dashboard Access**: ☐ Yes ☐ No
  - If yes, provide login credentials
- [ ] **Git Repository Access**: ☐ Yes ☐ No
  - For automatic deployments

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

---

## 🚀 Deployment Timeline

**Estimated Time**: 2-4 hours

**Steps**:
1. ✅ Information Collection (30 min)
2. ✅ AWS Setup (30-60 min)
3. ✅ Domain Configuration (30-60 min)
4. ✅ Testing & Verification (60-90 min)
5. ✅ Documentation Handover (30 min)

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

**Date**: _______________  
**Client Name**: _______________  
**Prepared By**: _______________


