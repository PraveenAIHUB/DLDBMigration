# 🎯 FIX LOGIN ERROR - 3 SIMPLE STEPS

## What's Wrong?
The backend can't connect to the database because **PostgreSQL is not running**.

---

## ✅ Solution (Pick the easiest option for you)

### 🐳 OPTION 1: Docker (Fastest - Recommended)

**Copy and paste these 4 commands:**

```bash
# 1. Start PostgreSQL
docker run -d --name carbidding-db -e POSTGRES_PASSWORD='Praveen0910!@' -e POSTGRES_DB=carbidding -p 5432:5432 postgres:14

# 2. Wait a moment, then setup database
sleep 10 && npm run setup:db

# 3. Start the app
npm run dev:all
```

**Done!** Open: http://localhost:5173/admin

Login:
- Email: `admin@carbidding.com`
- Password: `admin123`

---

### 💻 OPTION 2: Install PostgreSQL

#### macOS:
```bash
brew install postgresql@14
brew services start postgresql@14
createdb carbidding
npm run setup:db
npm run dev:all
```

#### Linux:
```bash
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb carbidding
npm run setup:db
npm run dev:all
```

#### Windows:
1. Download: https://www.postgresql.org/download/windows/
2. Install and start PostgreSQL
3. Run:
```bash
createdb carbidding
npm run setup:db
npm run dev:all
```

**Login at:** http://localhost:5173/admin
- Email: `admin@carbidding.com`
- Password: `admin123`

---

### 🔧 OPTION 3: One-Click Setup Script

**Linux/macOS:**
```bash
./setup-db.sh
npm run dev:all
```

**Windows:**
```bash
setup-db.bat
npm run dev:all
```

**Login at:** http://localhost:5173/admin
- Email: `admin@carbidding.com`
- Password: `admin123`

---

## That's It!

After running one of the options above:

1. ✅ PostgreSQL will be running
2. ✅ Database tables will be created
3. ✅ Admin user will be created
4. ✅ You can login

---

## 📍 Quick Reference

**Admin Login:**
- URL: http://localhost:5173/admin
- Email: admin@carbidding.com
- Password: admin123

**Start App:**
```bash
npm run dev:all
```

**Stop Docker Database (if using Docker):**
```bash
docker stop carbidding-db
```

**Start Docker Database Again:**
```bash
docker start carbidding-db
```

---

## Need More Help?

- Full guide: `QUICK_FIX_DATABASE.md`
- Detailed fix: `FIX_LOGIN_NOW.md`
- Login guide: `LOGIN_GUIDE.md`
