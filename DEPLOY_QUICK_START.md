# Quick Start: Deploy to AWS Amplify

## Fastest Deployment Method (5 minutes)

### Step 1: Prepare Environment Variables

1. Get your Supabase credentials:
   - Go to Supabase Dashboard → Settings → API
   - Copy **Project URL** and **anon/public key**

2. Create `.env.production` file (optional, for local testing):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 2: Push to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 3: Deploy via AWS Amplify Console

1. **Go to AWS Amplify Console:**
   - Visit: https://console.aws.amazon.com/amplify
   - Sign in to your AWS account

2. **Create New App:**
   - Click "New app" → "Host web app"
   - Choose your Git provider (GitHub/GitLab/Bitbucket)
   - Authorize AWS to access your repository
   - Select repository: `DLCarBiddingPlatform-main`
   - Select branch: `main`

3. **Configure Build:**
   - Amplify will auto-detect the build settings from `amplify.yml`
   - Review and click "Next"

4. **Add Environment Variables:**
   - Click "Advanced settings"
   - Add environment variables:
     - Key: `VITE_SUPABASE_URL`
     - Value: `https://your-project.supabase.co`
     - Key: `VITE_SUPABASE_ANON_KEY`
     - Value: `your-anon-key-here`

5. **Deploy:**
   - Click "Save and deploy"
   - Wait 3-5 minutes for build and deployment
   - Your app will be live at: `https://main.xxxxx.amplifyapp.com`

### Step 4: Configure Supabase CORS

1. Go to Supabase Dashboard → Settings → API
2. Under "CORS Configuration", add:
   - `https://main.xxxxx.amplifyapp.com`
   - `https://*.amplifyapp.com` (for all Amplify subdomains)

### Step 5: Test Your Deployment

- Visit your Amplify URL
- Test user registration
- Test admin login
- Verify cars are loading

---

## Custom Domain Setup (Optional)

1. In Amplify Console, go to your app
2. Click "Domain management" → "Add domain"
3. Enter your domain (e.g., `carbidding.yourdomain.com`)
4. Follow DNS configuration instructions
5. SSL certificate is automatically provisioned

---

## Auto-Deploy on Git Push

Amplify automatically deploys when you push to the connected branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
# Amplify will automatically build and deploy
```

---

## Troubleshooting

**Build fails?**
- Check build logs in Amplify Console
- Ensure environment variables are set correctly
- Verify Node.js version (should be 18+)

**App shows blank page?**
- Check browser console for errors
- Verify Supabase CORS is configured
- Check environment variables are correct

**CORS errors?**
- Add your Amplify domain to Supabase allowed origins
- Format: `https://main.xxxxx.amplifyapp.com`

---

## Cost

- **Free Tier:** 15 GB storage, 5 GB served per month
- **After Free Tier:** ~$0.15/GB storage, $0.15/GB transfer
- **Typical Cost:** $5-20/month for small to medium traffic

---

## Next Steps

1. Set up custom domain (optional)
2. Configure monitoring and alerts
3. Set up staging environment (connect to different branch)
4. Review security settings

For detailed deployment options, see `AWS_DEPLOYMENT_GUIDE.md`

