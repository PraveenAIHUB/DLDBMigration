# AWS Deployment Guide

This guide covers deploying the Car Bidding Platform to AWS. The application consists of a React/Vite frontend with Supabase as the backend.

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Node.js and npm installed locally
- Supabase project set up and running

## Option 1: AWS Amplify (Recommended - Easiest)

AWS Amplify is the easiest way to deploy React applications to AWS.

### Step 1: Prepare Your Application

1. **Build the application locally to test:**
   ```bash
   npm install
   npm run build
   ```

2. **Create environment variables file** (`.env.production`):
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Step 2: Deploy via AWS Amplify Console

1. **Go to AWS Amplify Console:**
   - Navigate to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click "New app" → "Host web app"

2. **Connect Repository:**
   - Choose your Git provider (GitHub, GitLab, Bitbucket, or AWS CodeCommit)
   - Authorize and select your repository
   - Select the branch to deploy (usually `main` or `master`)

3. **Configure Build Settings:**
   - Amplify will auto-detect Vite/React
   - Build settings should be:
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
   - Go to "Environment variables" in Amplify Console
   - Add:
     - `VITE_SUPABASE_URL` = Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key

5. **Deploy:**
   - Click "Save and deploy"
   - Amplify will build and deploy your app
   - You'll get a URL like: `https://main.xxxxx.amplifyapp.com`

### Step 3: Custom Domain (Optional)

1. In Amplify Console, go to "Domain management"
2. Click "Add domain"
3. Enter your domain name
4. Follow the DNS configuration instructions
5. SSL certificate is automatically provisioned

---

## Option 2: AWS S3 + CloudFront (Static Hosting)

This option provides more control and is cost-effective for static sites.

### Step 1: Create S3 Bucket

```bash
# Create bucket (replace with your unique bucket name)
aws s3 mb s3://your-car-bidding-platform

# Enable static website hosting
aws s3 website s3://your-car-bidding-platform \
  --index-document index.html \
  --error-document index.html
```

### Step 2: Configure S3 Bucket Policy

Create a file `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-car-bidding-platform/*"
    }
  ]
}
```

Apply the policy:
```bash
aws s3api put-bucket-policy \
  --bucket your-car-bidding-platform \
  --policy file://bucket-policy.json
```

### Step 3: Build and Upload

```bash
# Build the application
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-car-bidding-platform --delete

# Set correct content types
aws s3 cp dist/index.html s3://your-car-bidding-platform/index.html \
  --content-type "text/html" \
  --cache-control "no-cache"

aws s3 sync dist/assets s3://your-car-bidding-platform/assets \
  --content-type "application/javascript" \
  --cache-control "public, max-age=31536000"
```

### Step 4: Create CloudFront Distribution

1. **Go to CloudFront Console:**
   - Navigate to [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront)

2. **Create Distribution:**
   - Origin Domain: Select your S3 bucket
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Default Root Object: `index.html`

3. **Add Error Pages:**
   - HTTP Error Code: `403`
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200`
   - Repeat for `404` errors

4. **Deploy:**
   - Create distribution
   - Wait for deployment (15-20 minutes)
   - Use the CloudFront domain name

### Step 5: Environment Variables

Since S3 is static, you need to inject environment variables at build time:

1. **Create `.env.production`:**
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Build with production env:**
   ```bash
   npm run build
   ```

The environment variables will be embedded in the build.

---

## Option 3: AWS Elastic Beanstalk

For more control and if you need server-side features.

### Step 1: Install EB CLI

```bash
pip install awsebcli
```

### Step 2: Initialize Elastic Beanstalk

```bash
eb init -p "Node.js" car-bidding-platform --region us-east-1
```

### Step 3: Create Environment

```bash
eb create car-bidding-platform-env
```

### Step 4: Configure Environment Variables

```bash
eb setenv VITE_SUPABASE_URL=your_supabase_url \
          VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 5: Deploy

```bash
npm run build
eb deploy
```

---

## Option 4: AWS EC2 (Full Control)

For maximum control and customization.

### Step 1: Launch EC2 Instance

1. **Go to EC2 Console:**
   - Launch a new instance
   - Choose Ubuntu Server 22.04 LTS
   - Instance type: t2.micro (free tier) or t3.small
   - Configure security group:
     - HTTP (port 80) from anywhere
     - HTTPS (port 443) from anywhere
     - SSH (port 22) from your IP

### Step 2: Connect and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 3: Deploy Application

```bash
# Clone repository
git clone https://github.com/your-username/DLCarBiddingPlatform.git
cd DLCarBiddingPlatform

# Install dependencies
npm install

# Create .env file
nano .env.production
# Add:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Build application
npm run build

# Serve with PM2
pm2 serve dist 3000 --name car-bidding-platform
pm2 save
pm2 startup
```

### Step 4: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace with:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Setup SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Environment Variables Setup

### Required Variables

Create `.env.production` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Finding Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

---

## Post-Deployment Checklist

### 1. Update Supabase Settings

- **CORS Configuration:**
  - Go to Supabase Dashboard → Settings → API
  - Add your AWS domain to allowed origins:
    - `https://your-domain.com`
    - `https://www.your-domain.com`

- **RLS Policies:**
  - Verify all RLS policies are correctly configured
  - Test that users can access data properly

### 2. Test Application

- [ ] User registration works
- [ ] User login works
- [ ] Admin login works
- [ ] Business user login works
- [ ] Cars are visible to approved users
- [ ] Bidding functionality works
- [ ] Profile and bidding history display correctly

### 3. Monitoring

- **Set up CloudWatch (for AWS services):**
  - Monitor application logs
  - Set up alarms for errors

- **Supabase Monitoring:**
  - Check Supabase dashboard for API usage
  - Monitor database performance

### 4. Security

- [ ] HTTPS is enabled (SSL certificate)
- [ ] Environment variables are secure
- [ ] CORS is properly configured
- [ ] RLS policies are active
- [ ] API keys are not exposed in client code

---

## CI/CD Setup (Optional)

### GitHub Actions for Auto-Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://your-car-bidding-platform --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id YOUR_DISTRIBUTION_ID \
            --paths "/*"
```

---

## Cost Estimation

### AWS Amplify
- **Free Tier:** 15 GB storage, 5 GB served per month
- **After Free Tier:** ~$0.15/GB storage, $0.15/GB transfer
- **Estimated Cost:** $5-20/month for small to medium traffic

### S3 + CloudFront
- **S3:** $0.023/GB storage, $0.09/GB transfer
- **CloudFront:** $0.085/GB (first 10 TB)
- **Estimated Cost:** $5-15/month for small to medium traffic

### EC2
- **t2.micro:** Free tier eligible (750 hours/month)
- **t3.small:** ~$15/month
- **Data Transfer:** $0.09/GB
- **Estimated Cost:** $15-30/month

---

## Troubleshooting

### Issue: Environment variables not working
**Solution:** Ensure variables are prefixed with `VITE_` and rebuild the application.

### Issue: 404 errors on page refresh
**Solution:** Configure your hosting to serve `index.html` for all routes (SPA routing).

### Issue: CORS errors
**Solution:** Add your domain to Supabase allowed origins in Settings → API.

### Issue: RLS blocking data
**Solution:** Verify RLS policies are correctly configured and migrations are applied.

### Issue: Build fails
**Solution:** Check Node.js version (requires 18+), ensure all dependencies are installed.

---

## Recommended Approach

**For most users:** Use **AWS Amplify** - it's the easiest, includes CI/CD, SSL, and CDN automatically.

**For advanced users:** Use **S3 + CloudFront** - more control, better for high traffic, cost-effective.

**For full control:** Use **EC2** - if you need server-side features or custom configurations.

---

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

