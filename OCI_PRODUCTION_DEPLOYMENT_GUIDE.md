# OCI Production Deployment Guide
## Car Bidding Platform - Oracle Cloud Infrastructure Deployment

This document provides all the information and steps needed to deploy the Car Bidding Platform to Oracle Cloud Infrastructure (OCI) production environment.

---

## 📋 Pre-Deployment Checklist

### Information Required from Client

Before starting deployment, collect the following information:

#### 1. Domain & DNS Information
- [ ] **Production Domain Name**: (e.g., `carbidding.com` or `app.carbidding.com`)
- [ ] **Domain Registrar**: (e.g., GoDaddy, Namecheap, OCI DNS)
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

#### 3. OCI Account Information
- [ ] **OCI Tenancy OCID**: 
- [ ] **OCI Region Preference**: (e.g., `us-ashburn-1`, `eu-frankfurt-1`, `ap-sydney-1`)
- [ ] **Compartment Name**: (Where resources will be created)
- [ ] **Budget Limit**: (e.g., $50/month, $100/month)
- [ ] **OCI User OCID**: (For API access if needed)
- [ ] **OCI API Key**: (For CI/CD if needed)

#### 4. Application Configuration
- [ ] **Default Admin Email**: (e.g., `admin@carbidding.com`)
- [ ] **Default Admin Password**: (Will need to be changed on first login)
- [ ] **Email Service**: (If using custom email for password resets)
- [ ] **SMS Service**: (If using OTP/SMS features)

#### 5. Security & Compliance
- [ ] **SSL Certificate**: (OCI provides free SSL via Let's Encrypt or OCI Certificates)
- [ ] **Backup Requirements**: (Daily, weekly, etc.)
- [ ] **Monitoring Requirements**: (OCI Monitoring, external monitoring)
- [ ] **Compliance Needs**: (GDPR, HIPAA, etc.)

---

## 🚀 Recommended Deployment Methods

### Option 1: OCI Object Storage + CDN (Recommended - Cost-Effective)

**Why this method?**
- ✅ Very cost-effective ($0-5/month for small traffic)
- ✅ Highly scalable
- ✅ Built-in CDN
- ✅ Simple setup
- ✅ Free tier available

### Option 2: OCI Compute Instance + Nginx

**Why this method?**
- ✅ Full control
- ✅ Can add server-side features
- ✅ Good for custom configurations
- ✅ Free tier available (Always Free tier)

### Option 3: OCI Container Engine (OKE)

**Why this method?**
- ✅ Containerized deployment
- ✅ Auto-scaling
- ✅ Best for microservices
- ⚠️ More complex setup

---

## 🎯 Option 1: OCI Object Storage + CDN (Recommended)

### Prerequisites

1. **OCI CLI Installation:**
   ```bash
   # Install OCI CLI
   pip install oci-cli
   
   # Configure OCI CLI
   oci setup config
   ```
   Follow prompts to enter:
   - User OCID
   - Tenancy OCID
   - Region
   - API key path

2. **Verify Installation:**
   ```bash
   oci iam region list
   ```

### Step 1: Create Object Storage Bucket

1. **Via OCI Console:**
   - Navigate to **Object Storage** → **Buckets**
   - Click **Create Bucket**
   - Name: `carbidding-platform-prod`
   - Storage Tier: **Standard**
   - Visibility: **Private** (we'll use pre-authenticated requests or CDN)
   - Click **Create**

2. **Via OCI CLI:**
   ```bash
   # Create bucket
   oci os bucket create \
     --namespace-name $(oci os ns get --query 'data' --raw-output) \
     --compartment-id <COMPARTMENT_OCID> \
     --name carbidding-platform-prod \
     --public-access-type NoPublicAccess
   ```

### Step 2: Configure Bucket for Static Website Hosting

1. **Enable Static Website Hosting:**
   ```bash
   # Note: OCI Object Storage doesn't have built-in static website hosting
   # We'll use CDN or Compute instance with Nginx
   # For direct bucket access, we'll use pre-authenticated requests
   ```

2. **Create Pre-Authenticated Request (Optional for direct access):**
   - Go to bucket → **Pre-Authenticated Requests**
   - Click **Create Pre-Authenticated Request**
   - Access Type: **Object Read**
   - Object Name: Leave blank (for all objects)
   - Expiration: Set as needed
   - Copy the URL

### Step 3: Build and Upload Application

1. **Set Environment Variables:**
   ```bash
   export VITE_SUPABASE_URL=https://xxxxx.supabase.co
   export VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Build Application:**
   ```bash
   npm install
   npm run build
   ```

3. **Upload to Object Storage:**
   ```bash
   # Upload all files
   oci os object put \
     --bucket-name carbidding-platform-prod \
     --file dist/index.html \
     --name index.html \
     --content-type "text/html" \
     --cache-control "no-cache"

   # Upload assets directory
   oci os object bulk-upload \
     --bucket-name carbidding-platform-prod \
     --src-dir dist/assets \
     --prefix assets/
   ```

   **Or use sync script:**
   ```bash
   # Upload entire dist folder
   cd dist
   for file in $(find . -type f); do
     oci os object put \
       --bucket-name carbidding-platform-prod \
       --file "$file" \
       --name "$file" \
       --force
   done
   ```

### Step 4: Create OCI CDN Distribution

1. **Via OCI Console:**
   - Navigate to **Networking** → **CDN**
   - Click **Create CDN Distribution**
   - **Origin Type**: Object Storage
   - **Origin Domain**: Select your bucket
   - **Distribution Name**: `carbidding-platform-cdn`
   - **Compartment**: Select your compartment
   - **CDN Policy**: Create new or use existing
   - Click **Create**

2. **Configure CDN Settings:**
   - **Caching Rules**: 
     - HTML files: No cache
     - JS/CSS files: Cache for 1 year
   - **Compression**: Enable GZIP
   - **Custom Domain**: Add your domain (optional)

3. **Wait for Deployment:**
   - CDN distribution takes 15-30 minutes to deploy
   - You'll get a CDN URL: `https://xxxxx.cdn.oci.com`

### Step 5: Configure Custom Domain

1. **Request SSL Certificate:**
   - Go to **Certificates** → **Certificates**
   - Click **Import Certificate**
   - Or use Let's Encrypt (via Compute instance)

2. **Add Custom Domain to CDN:**
   - In CDN distribution, go to **Custom Domains**
   - Click **Add Custom Domain**
   - Enter domain: `carbidding.com`
   - Select SSL certificate
   - Click **Add**

3. **Configure DNS:**
   - Add CNAME record in your DNS provider:
     ```
     Type: CNAME
     Name: @ (or www)
     Value: [CDN hostname from OCI]
     ```

---

## 🖥️ Option 2: OCI Compute Instance + Nginx

### Step 1: Launch Compute Instance

1. **Via OCI Console:**
   - Navigate to **Compute** → **Instances**
   - Click **Create Instance**
   - **Name**: `carbidding-platform-prod`
   - **Image**: **Canonical Ubuntu 22.04**
   - **Shape**: **VM.Standard.E2.1.Micro** (Always Free) or **VM.Standard.E2.1** (paid)
   - **Networking**: 
     - Create new VCN or use existing
     - Public IP: **Assign a public IPv4 address**
   - **SSH Keys**: Upload your public SSH key
   - Click **Create**

2. **Configure Security List:**
   - Allow **HTTP (80)** from `0.0.0.0/0`
   - Allow **HTTPS (443)** from `0.0.0.0/0`
   - Allow **SSH (22)** from your IP only

### Step 2: Connect and Setup

1. **SSH into Instance:**
   ```bash
   ssh -i your-key.pem ubuntu@<PUBLIC_IP>
   ```

2. **Update System:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

4. **Install Nginx:**
   ```bash
   sudo apt install -y nginx
   ```

5. **Install PM2 (Optional):**
   ```bash
   sudo npm install -g pm2
   ```

### Step 3: Deploy Application

1. **Clone Repository:**
   ```bash
   git clone https://github.com/your-username/DLCarBiddingPlatform.git
   cd DLCarBiddingPlatform
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Create Environment File:**
   ```bash
   nano .env.production
   ```
   Add:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Build Application:**
   ```bash
   npm run build
   ```

5. **Copy to Web Directory:**
   ```bash
   sudo cp -r dist/* /var/www/html/
   sudo chown -R www-data:www-data /var/www/html
   ```

### Step 4: Configure Nginx

1. **Create Nginx Configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/carbidding-platform
   ```

2. **Add Configuration:**
   ```nginx
   server {
       listen 80;
       server_name carbidding.com www.carbidding.com;

       root /var/www/html;
       index index.html;

       # SPA routing - serve index.html for all routes
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Cache static assets
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }

       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
   }
   ```

3. **Enable Site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/carbidding-platform /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Step 5: Setup SSL with Let's Encrypt

1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain Certificate:**
   ```bash
   sudo certbot --nginx -d carbidding.com -d www.carbidding.com
   ```

3. **Auto-Renewal:**
   ```bash
   sudo certbot renew --dry-run
   ```

### Step 6: Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## 🔄 Option 3: OCI Container Engine (OKE) - Advanced

### Prerequisites

- OCI CLI configured
- kubectl installed
- Docker installed (for building images)

### Step 1: Create OKE Cluster

1. **Via OCI Console:**
   - Navigate to **Developer Services** → **Kubernetes Clusters (OKE)**
   - Click **Create Cluster**
   - Choose **Quick Create**
   - Configure:
     - Name: `carbidding-platform-cluster`
     - Kubernetes Version: Latest
     - Node Pool: 1-2 nodes
     - Shape: **VM.Standard.E2.1.Micro** (free tier)
   - Click **Create**

### Step 2: Build Docker Image

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   ARG VITE_SUPABASE_URL
   ARG VITE_SUPABASE_ANON_KEY
   ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
   ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create nginx.conf:**
   ```nginx
   server {
       listen 80;
       root /usr/share/nginx/html;
       index index.html;
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Build and Push to OCI Container Registry:**
   ```bash
   # Login to OCI Container Registry
   docker login <region>.ocir.io
   
   # Build image
   docker build \
     --build-arg VITE_SUPABASE_URL=https://xxxxx.supabase.co \
     --build-arg VITE_SUPABASE_ANON_KEY=your-key \
     -t <region>.ocir.io/<tenancy>/carbidding-platform:latest .
   
   # Push image
   docker push <region>.ocir.io/<tenancy>/carbidding-platform:latest
   ```

### Step 3: Deploy to OKE

1. **Configure kubectl:**
   ```bash
   oci ce cluster create-kubeconfig \
     --cluster-id <CLUSTER_OCID> \
     --file ~/.kube/config
   ```

2. **Create Deployment:**
   ```yaml
   # deployment.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: carbidding-platform
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: carbidding-platform
     template:
       metadata:
         labels:
           app: carbidding-platform
       spec:
         containers:
         - name: carbidding-platform
           image: <region>.ocir.io/<tenancy>/carbidding-platform:latest
           ports:
           - containerPort: 80
   ```

3. **Create Service:**
   ```yaml
   # service.yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: carbidding-platform-service
   spec:
     selector:
       app: carbidding-platform
     ports:
     - port: 80
       targetPort: 80
     type: LoadBalancer
   ```

4. **Deploy:**
   ```bash
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   ```

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
- [ ] **Security Groups**: Verify firewall rules are correct

### Performance Testing

- [ ] **Page Load Speed**: Test initial page load (< 3 seconds)
- [ ] **Image Loading**: Verify images load properly
- [ ] **Real-time Updates**: Test live bid updates
- [ ] **Concurrent Users**: Test with multiple users bidding
- [ ] **CDN Performance**: Verify CDN is serving content (if using CDN)

### Monitoring Setup

- [ ] **OCI Monitoring**: Set up basic monitoring
- [ ] **Error Tracking**: Consider adding error tracking (Sentry, etc.)
- [ ] **Analytics**: Set up Google Analytics or similar (optional)
- [ ] **Uptime Monitoring**: Set up uptime monitoring (UptimeRobot, etc.)

---

## 💰 Cost Estimation

### OCI Object Storage + CDN
- **Object Storage**: 
  - Free tier: 10 GB storage, 10,000 requests/month
  - After free tier: $0.0255/GB storage, $0.0045/10,000 requests
- **CDN**:
  - Free tier: 10 TB egress/month
  - After free tier: $0.0085/GB (first 10 TB)
- **Estimated Monthly Cost**: $0-5 for small to medium traffic

### OCI Compute Instance
- **VM.Standard.E2.1.Micro**: Always Free (up to 2 instances)
- **VM.Standard.E2.1**: ~$30/month
- **Data Transfer**: First 10 TB free, then $0.0085/GB
- **Estimated Monthly Cost**: $0-30/month (free tier available)

### OCI Container Engine (OKE)
- **Control Plane**: Free
- **Worker Nodes**: Same as Compute instances
- **Load Balancer**: ~$15/month
- **Estimated Monthly Cost**: $15-50/month

**Note**: OCI offers generous Always Free tier, making it very cost-effective for small to medium applications.

---

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example | Where to Set |
|----------|-------------|---------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` | Build time / .env file |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | `eyJhbGc...` | Build time / .env file |

### Setting Environment Variables

**For Object Storage + CDN:**
- Set at build time before uploading
- Variables are embedded in the build

**For Compute Instance:**
- Create `.env.production` file
- Or set in system environment

**For OKE:**
- Use build args in Dockerfile
- Or ConfigMaps/Secrets in Kubernetes

---

## 🚨 Troubleshooting

### Issue: Build Fails

**Solutions**:
1. Check Node.js version (requires 18+)
2. Verify all dependencies are installed
3. Check for TypeScript errors
4. Verify environment variables are set

### Issue: Environment Variables Not Working

**Solutions**:
1. Verify variables start with `VITE_`
2. Rebuild application after adding variables
3. Check browser console for errors
4. Verify Supabase URL and key are correct

### Issue: 404 Errors on Page Refresh

**Solutions**:
1. **For Nginx**: Ensure `try_files $uri $uri/ /index.html;` is configured
2. **For CDN**: Configure error pages to redirect to index.html
3. **For OKE**: Configure ingress rules properly

### Issue: CORS Errors

**Solutions**:
1. Add your domain to Supabase CORS settings
2. Verify redirect URLs in Supabase Auth settings
3. Check that you're using HTTPS (not HTTP)

### Issue: Cannot Access Object Storage

**Solutions**:
1. Verify bucket policies allow access
2. Check pre-authenticated request URLs
3. Verify CDN is properly configured
4. Check security lists/firewall rules

### Issue: SSL Certificate Issues

**Solutions**:
1. Verify DNS records are correct
2. Wait for DNS propagation (up to 48 hours)
3. Check certificate expiration
4. Verify domain ownership

---

## 📝 Maintenance & Updates

### Deploying Updates

**For Object Storage:**
1. Build locally: `npm run build`
2. Upload new files to bucket
3. Invalidate CDN cache if using CDN

**For Compute Instance:**
1. SSH into instance
2. Pull latest code: `git pull`
3. Rebuild: `npm run build`
4. Copy to web directory: `sudo cp -r dist/* /var/www/html/`

**For OKE:**
1. Build new Docker image
2. Push to container registry
3. Update deployment: `kubectl rollout restart deployment carbidding-platform`

### Backup Strategy

1. **Database Backups**: 
   - Supabase provides automatic daily backups
   - Configure additional backups in Supabase dashboard

2. **Code Backups**:
   - Git repository serves as code backup
   - Keep multiple branches (main, dev, staging)

3. **Configuration Backups**:
   - Document all environment variables
   - Keep secure notes of API keys (use password manager)
   - Export OCI configurations

### Monitoring

1. **OCI Monitoring**:
   - Set up alarms in OCI Monitoring
   - Monitor compute instance metrics
   - Track object storage usage

2. **Application Health**:
   - Set up uptime monitoring
   - Monitor error rates
   - Track user activity

3. **Costs**:
   - Set up OCI budget alerts
   - Monitor monthly costs
   - Review and optimize regularly

---

## 📞 Support & Resources

### Documentation
- [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)
- [OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm)
- [OCI CDN](https://docs.oracle.com/en-us/iaas/Content/CDN/home.htm)
- [Supabase Docs](https://supabase.com/docs)

### Getting Help
- Check OCI Console for service status
- Review application logs
- Check browser console for client-side errors
- Review Supabase logs in Supabase Dashboard

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
- [ ] Client has access to all accounts (OCI, Supabase)
- [ ] Cost monitoring/alerts configured
- [ ] Security groups/firewall rules configured
- [ ] CDN cache configured (if using CDN)

---

## 📋 Information to Provide to Client

### Access Credentials

1. **OCI Console**:
   - URL: `https://cloud.oracle.com`
   - Login: [Client's OCI account]

2. **Supabase Dashboard**:
   - URL: `https://app.supabase.com`
   - Login: [Client's Supabase account]

3. **Application URLs**:
   - Production: `https://carbidding.com`
   - Admin Portal: `https://carbidding.com/admin`
   - Default Admin: `admin@carbidding.com` / [password]

### Important Notes for Client

1. **Environment Variables**: 
   - Stored in build configuration or .env files
   - Never share or commit to Git
   - Update if Supabase credentials change

2. **Updates**:
   - For Object Storage: Rebuild and upload new files
   - For Compute: SSH and pull latest code
   - For OKE: Build new image and deploy

3. **Costs**:
   - Estimated: $0-30/month (free tier available)
   - Supabase: Free tier available, scales as needed
   - Set up budget alerts in OCI

4. **Support**:
   - Check logs in OCI Console for issues
   - Check Supabase Dashboard for database issues
   - Contact support if persistent issues occur

---

## 🆚 OCI vs AWS Comparison

| Feature | OCI | AWS |
|---------|-----|-----|
| **Free Tier** | Always Free (generous) | 12 months free |
| **Object Storage** | Object Storage | S3 |
| **CDN** | OCI CDN | CloudFront |
| **Compute** | Compute Instances | EC2 |
| **Container** | OKE | EKS |
| **Cost (Small App)** | $0-5/month | $5-20/month |
| **Ease of Use** | Moderate | Easy (Amplify) |
| **Documentation** | Good | Excellent |

**Recommendation**: OCI is excellent for cost-conscious deployments, especially with the Always Free tier. AWS Amplify is easier for beginners.

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Prepared For**: [Client Name]


