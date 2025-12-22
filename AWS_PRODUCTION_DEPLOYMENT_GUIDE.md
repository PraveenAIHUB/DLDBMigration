# AWS Production Deployment Guide
## Car Bidding Platform - Complete Deployment Checklist

This document provides all the information and steps needed to deploy the Car Bidding Platform to AWS production environment.

---

## 📋 Pre-Deployment Checklist

### Information Required from Client

Before starting deployment, collect the following information:

#### 1. Domain & DNS Information
- [ ] **Production Domain Name**: (e.g., `carbidding.com` or `app.carbidding.com`)
- [ ] **Domain Registrar**: (e.g., GoDaddy, Namecheap, AWS Route 53)
- [ ] **DNS Access**: Ability to modify DNS records
- [ ] **Subdomain Preference**: (e.g., `www.carbidding.com` or `app.carbidding.com`)

#### 2. Supabase Configuration
- [ ] **Supabase Project URL**: `https://xxxxx.supabase.co`
- [ ] **Supabase Anon Key**: (Public/anon key from Supabase dashboard)
- [ ] **Supabase Service Role Key**: (For admin operations - keep secure)
- [ ] **Supabase Project Region**: (e.g., `us-east-1`, `eu-west-1`)

**How to get Supabase credentials:**
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon public** key → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → Keep secure, for backend operations only

#### 3. AWS Account Information
- [ ] **AWS Account ID**: 
- [ ] **AWS Region Preference**: (e.g., `us-east-1`, `eu-west-1`)
- [ ] **AWS Access Key ID**: (For CI/CD if needed)
- [ ] **AWS Secret Access Key**: (For CI/CD if needed)
- [ ] **Budget Limit**: (e.g., $50/month, $100/month)

#### 4. Application Configuration
- [ ] **Default Admin Email**: (e.g., `admin@carbidding.com`)
- [ ] **Default Admin Password**: (Will need to be changed on first login)
- [ ] **Email Service**: (If using custom email for password resets)
- [ ] **SMS Service**: (If using OTP/SMS features)

#### 5. Security & Compliance
- [ ] **SSL Certificate**: (AWS provides free SSL via ACM)
- [ ] **Backup Requirements**: (Daily, weekly, etc.)
- [ ] **Monitoring Requirements**: (CloudWatch, external monitoring)
- [ ] **Compliance Needs**: (GDPR, HIPAA, etc.)

---

## 🚀 Recommended Deployment Method: AWS Amplify

**Why AWS Amplify?**
- ✅ Easiest setup (15-30 minutes)
- ✅ Automatic SSL certificates
- ✅ Built-in CDN (CloudFront)
- ✅ Automatic deployments from Git
- ✅ Free tier available
- ✅ Cost-effective ($5-20/month)

### Step-by-Step Deployment

#### Step 1: Prepare Repository

1. **Ensure code is in Git repository:**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Verify build works locally:**
   ```bash
   npm install
   npm run build
   ```
   - Check that `dist/` folder is created
   - Verify no build errors

#### Step 2: Create AWS Amplify App

1. **Login to AWS Console:**
   - Go to [AWS Console](https://console.aws.amazon.com)
   - Navigate to **AWS Amplify** service

2. **Create New App:**
   - Click **"New app"** → **"Host web app"**
   - Choose your Git provider:
     - GitHub
     - GitLab
     - Bitbucket
     - AWS CodeCommit
   - Authorize AWS to access your repository
   - Select repository: `DLCarBiddingPlatform-main`
   - Select branch: `main` (or your production branch)
   - Click **"Next"**

3. **Configure Build Settings:**
   
   AWS Amplify will auto-detect Vite, but verify these settings:
   
   **Build settings** (amplify.yml):
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

4. **Add Environment Variables:**
   
   In Amplify Console, go to **"Environment variables"** and add:
   
   | Variable Name | Value | Description |
   |--------------|-------|-------------|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Your Supabase anon/public key |
   
   **Important:** 
   - Variables must start with `VITE_` to be accessible in the build
   - Never commit these values to Git
   - Use different values for different environments (dev/staging/prod)

5. **Review and Deploy:**
   - Review all settings
   - Click **"Save and deploy"**
   - Wait for build to complete (5-10 minutes)
   - You'll get a URL: `https://main.xxxxx.amplifyapp.com`

#### Step 3: Configure Custom Domain

1. **Add Domain:**
   - In Amplify Console, go to **"Domain management"**
   - Click **"Add domain"**
   - Enter your domain: `carbidding.com` (or your domain)
   - Click **"Configure domain"**

2. **DNS Configuration:**
   
   AWS will provide DNS records. Add these to your domain registrar:
   
   **For root domain (carbidding.com):**
   ```
   Type: A
   Name: @
   Value: [AWS provided IP]
   
   Type: AAAA
   Name: @
   Value: [AWS provided IPv6]
   ```
   
   **For subdomain (www.carbidding.com):**
   ```
   Type: CNAME
   Name: www
   Value: [AWS provided CNAME]
   ```

3. **SSL Certificate:**
   - AWS automatically provisions SSL certificate via ACM
   - Wait 15-30 minutes for DNS propagation
   - SSL will be active automatically

4. **Verify Domain:**
   - Wait for DNS propagation (can take up to 48 hours, usually 1-2 hours)
   - Check domain status in Amplify Console
   - Once verified, your app will be live at your custom domain

#### Step 4: Update Supabase Settings

1. **Configure CORS:**
   - Go to Supabase Dashboard → **Settings** → **API**
   - Under **"CORS Configuration"**, add your production domain:
     ```
     https://carbidding.com
     https://www.carbidding.com
     https://main.xxxxx.amplifyapp.com
     ```

2. **Update Redirect URLs:**
   - Go to **Authentication** → **URL Configuration**
   - Add to **"Redirect URLs"**:
     ```
     https://carbidding.com/**
     https://www.carbidding.com/**
     https://carbidding.com/reset-password
     ```

3. **Verify RLS Policies:**
   - Ensure all Row Level Security policies are active
   - Test that users can access data properly

---

## 🔄 Alternative: AWS S3 + CloudFront (Advanced)

Use this method if you need more control or have specific requirements.

### Prerequisites
- AWS CLI installed and configured
- AWS account with S3 and CloudFront access

### Step 1: Create S3 Bucket

```bash
# Create bucket (use unique name)
aws s3 mb s3://carbidding-platform-prod --region us-east-1

# Enable static website hosting
aws s3 website s3://carbidding-platform-prod \
  --index-document index.html \
  --error-document index.html
```

### Step 2: Configure Bucket Policy

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::carbidding-platform-prod/*"
    }
  ]
}
```

Apply policy:
```bash
aws s3api put-bucket-policy \
  --bucket carbidding-platform-prod \
  --policy file://bucket-policy.json
```

### Step 3: Build and Deploy

```bash
# Set environment variables
export VITE_SUPABASE_URL=https://xxxxx.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key

# Build application
npm run build

# Upload to S3
aws s3 sync dist/ s3://carbidding-platform-prod --delete

# Set correct content types
aws s3 cp dist/index.html s3://carbidding-platform-prod/index.html \
  --content-type "text/html" \
  --cache-control "no-cache"

aws s3 sync dist/assets s3://carbidding-platform-prod/assets \
  --content-type "application/javascript" \
  --cache-control "public, max-age=31536000"
```

### Step 4: Create CloudFront Distribution

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront)
2. Click **"Create Distribution"**
3. Configure:
   - **Origin Domain**: Select your S3 bucket
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS
   - **Default Root Object**: `index.html`
4. Add Error Pages:
   - **403 Error** → `/index.html` (Response: 200)
   - **404 Error** → `/index.html` (Response: 200)
5. Create distribution (takes 15-20 minutes)

### Step 5: Configure Custom Domain

1. Request SSL certificate in **AWS Certificate Manager (ACM)**
2. Add domain to CloudFront distribution
3. Update DNS records as provided by AWS

---

## 📊 Post-Deployment Checklist

### Application Testing

- [ ] **User Registration**: Test new user signup
- [ ] **User Login**: Test user authentication
- [ ] **Admin Login**: Test admin portal access
  - URL: `https://yourdomain.com/admin`
  - Default: `admin@carbidding.com` / `admin123`
- [ ] **Business User Login**: Test business user access
- [ ] **Car Listing**: Verify cars are visible to approved users
- [ ] **Bidding**: Test placing bids
- [ ] **Real-time Updates**: Verify live bid updates work
- [ ] **Profile**: Test user profile and bid history
- [ ] **Excel Import**: Test admin car import functionality
- [ ] **Export**: Test data export features
- [ ] **Mobile Responsiveness**: Test on mobile devices
- [ ] **Password Reset**: Test password reset flow

### Security Verification

- [ ] **HTTPS**: Verify SSL certificate is active (green lock icon)
- [ ] **CORS**: Verify no CORS errors in browser console
- [ ] **Environment Variables**: Confirm no sensitive data in client code
- [ ] **RLS Policies**: Verify Row Level Security is working
- [ ] **API Keys**: Confirm anon key is public-safe (not service role key)

### Performance Testing

- [ ] **Page Load Speed**: Test initial page load (< 3 seconds)
- [ ] **Image Loading**: Verify images load properly
- [ ] **Real-time Updates**: Test live bid updates
- [ ] **Concurrent Users**: Test with multiple users bidding

### Monitoring Setup

- [ ] **CloudWatch**: Set up basic monitoring (if using AWS services)
- [ ] **Error Tracking**: Consider adding error tracking (Sentry, etc.)
- [ ] **Analytics**: Set up Google Analytics or similar (optional)
- [ ] **Uptime Monitoring**: Set up uptime monitoring (UptimeRobot, etc.)

---

## 💰 Cost Estimation

### AWS Amplify (Recommended)
- **Free Tier**: 
  - 15 GB storage
  - 5 GB served per month
  - 1,000 build minutes/month
- **After Free Tier**:
  - Storage: $0.15/GB/month
  - Transfer: $0.15/GB
  - Build: $0.01/build minute
- **Estimated Monthly Cost**: $5-20 for small to medium traffic

### S3 + CloudFront
- **S3 Storage**: $0.023/GB/month
- **S3 Transfer**: $0.09/GB (first 10 TB)
- **CloudFront**: $0.085/GB (first 10 TB)
- **Estimated Monthly Cost**: $5-15 for small to medium traffic

### EC2 (If needed)
- **t3.small**: ~$15/month
- **Data Transfer**: $0.09/GB
- **Estimated Monthly Cost**: $15-30/month

**Note**: Costs vary based on traffic. Start with free tier and scale as needed.

---

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example | Where to Set |
|----------|-------------|---------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` | Amplify Console / Build config |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | `eyJhbGc...` | Amplify Console / Build config |

### Optional Variables (if needed)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_APP_ENV` | Environment name | `production` |
| `VITE_APP_VERSION` | App version | `1.0.0` |

**Important Notes:**
- All variables must start with `VITE_` to be accessible in the build
- Variables are embedded at build time (not runtime)
- Never commit `.env` files with real credentials to Git
- Use different values for dev/staging/production

---

## 🚨 Troubleshooting

### Issue: Build Fails

**Symptoms**: Build fails in Amplify Console

**Solutions**:
1. Check build logs in Amplify Console
2. Verify Node.js version (requires 18+)
3. Ensure all dependencies are in `package.json`
4. Check for TypeScript errors: `npm run typecheck`
5. Verify environment variables are set correctly

### Issue: Environment Variables Not Working

**Symptoms**: App can't connect to Supabase

**Solutions**:
1. Verify variables start with `VITE_`
2. Rebuild application after adding variables
3. Check browser console for errors
4. Verify Supabase URL and key are correct
5. Check CORS configuration in Supabase

### Issue: 404 Errors on Page Refresh

**Symptoms**: Direct URL access or refresh shows 404

**Solutions**:
1. **For Amplify**: Add redirect rules in Amplify Console:
   - Source: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|eot)$)([^.]+$)/>`
   - Target: `/index.html`
   - Type: `200 (Rewrite)`

2. **For S3+CloudFront**: Already configured in error pages

### Issue: CORS Errors

**Symptoms**: Browser console shows CORS errors

**Solutions**:
1. Add your domain to Supabase CORS settings:
   - Supabase Dashboard → Settings → API
   - Add: `https://yourdomain.com`
2. Verify redirect URLs in Supabase Auth settings
3. Check that you're using HTTPS (not HTTP)

### Issue: Cars Not Loading

**Symptoms**: Car inventory is empty

**Solutions**:
1. Check browser console for errors
2. Verify Supabase connection
3. Check RLS policies in Supabase
4. Verify admin user has proper permissions
5. Check that lots are approved (if filtering by approved lots)

### Issue: Real-time Updates Not Working

**Symptoms**: Bids don't update in real-time

**Solutions**:
1. Check Supabase Realtime is enabled
2. Verify WebSocket connections in browser DevTools
3. Check Supabase project status
4. Verify RLS policies allow real-time subscriptions

---

## 📝 Maintenance & Updates

### Deploying Updates

**For AWS Amplify:**
1. Push changes to Git repository
2. Amplify automatically detects changes
3. Builds and deploys automatically
4. Usually takes 5-10 minutes

**For S3+CloudFront:**
1. Build locally: `npm run build`
2. Upload to S3: `aws s3 sync dist/ s3://bucket-name --delete`
3. Invalidate CloudFront cache:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --paths "/*"
   ```

### Backup Strategy

1. **Database Backups**: 
   - Supabase provides automatic daily backups
   - Can configure additional backups in Supabase dashboard

2. **Code Backups**:
   - Git repository serves as code backup
   - Keep multiple branches (main, dev, staging)

3. **Configuration Backups**:
   - Document all environment variables
   - Keep secure notes of API keys (use password manager)

### Monitoring

1. **Application Health**:
   - Set up uptime monitoring
   - Monitor error rates
   - Track user activity

2. **Performance**:
   - Monitor page load times
   - Track API response times
   - Monitor database performance in Supabase

3. **Costs**:
   - Set up AWS billing alerts
   - Monitor monthly costs
   - Review and optimize regularly

---

## 📞 Support & Resources

### Documentation
- [AWS Amplify Docs](https://docs.amplify.aws/)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

### Getting Help
- Check application logs in AWS Amplify Console
- Check Supabase logs in Supabase Dashboard
- Review browser console for client-side errors
- Check network tab for API errors

---

## ✅ Final Checklist Before Going Live

- [ ] All environment variables configured
- [ ] Custom domain configured and verified
- [ ] SSL certificate active (HTTPS working)
- [ ] Supabase CORS configured
- [ ] Supabase redirect URLs configured
- [ ] All features tested and working
- [ ] Admin credentials changed from default
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Documentation provided to client
- [ ] Client has access to all accounts (AWS, Supabase)
- [ ] Cost monitoring/alerts configured

---

## 📋 Information to Provide to Client

### Access Credentials

1. **AWS Amplify Console**:
   - URL: `https://console.aws.amazon.com/amplify`
   - Login: [Client's AWS account]

2. **Supabase Dashboard**:
   - URL: `https://app.supabase.com`
   - Login: [Client's Supabase account]

3. **Application URLs**:
   - Production: `https://carbidding.com`
   - Admin Portal: `https://carbidding.com/admin`
   - Default Admin: `admin@carbidding.com` / [password]

### Important Notes for Client

1. **Environment Variables**: 
   - Stored in AWS Amplify Console
   - Never share or commit to Git
   - Update if Supabase credentials change

2. **Updates**:
   - Push to Git repository triggers automatic deployment
   - Deployments take 5-10 minutes
   - Monitor deployment status in Amplify Console

3. **Costs**:
   - Estimated: $5-20/month (AWS Amplify)
   - Supabase: Free tier available, scales as needed
   - Set up billing alerts in AWS

4. **Support**:
   - Check logs in AWS Amplify Console for issues
   - Check Supabase Dashboard for database issues
   - Contact support if persistent issues occur

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Prepared For**: [Client Name]


