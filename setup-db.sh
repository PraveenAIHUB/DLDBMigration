#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  Car Bidding Platform - Database Setup"
echo "=================================================="
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo -e "${RED}❌ PostgreSQL is not running at localhost:5432${NC}"
  echo ""
  echo "Please start PostgreSQL first:"
  echo ""
  echo "  macOS:    brew services start postgresql@14"
  echo "  Linux:    sudo systemctl start postgresql"
  echo "  Docker:   docker run -d --name postgres -e POSTGRES_PASSWORD=Praveen0910!@ -p 5432:5432 postgres:14"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"
echo ""

# Check if database exists
echo "🗄️  Checking if database 'carbidding' exists..."
if psql -lqt -h localhost -U postgres | cut -d \| -f 1 | grep -qw carbidding; then
  echo -e "${GREEN}✅ Database 'carbidding' exists${NC}"
else
  echo -e "${YELLOW}⚠️  Database 'carbidding' does not exist. Creating...${NC}"
  createdb -h localhost -U postgres carbidding
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database created${NC}"
  else
    echo -e "${RED}❌ Failed to create database${NC}"
    exit 1
  fi
fi
echo ""

# Generate Prisma client
echo "📦 Generating Prisma client..."
npm run prisma:generate > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Prisma client generated${NC}"
else
  echo -e "${RED}❌ Failed to generate Prisma client${NC}"
  exit 1
fi
echo ""

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Migrations completed${NC}"
else
  echo -e "${RED}❌ Migrations failed${NC}"
  exit 1
fi
echo ""

# Create admin user
echo "👤 Creating admin user..."
npx tsx scripts/create-admin-direct.ts
echo ""

echo "=================================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "🎯 Login URL:  http://localhost:5173/admin"
echo "📧 Email:      admin@carbidding.com"
echo "🔑 Password:   admin123"
echo ""
echo "Start the application:"
echo "  npm run dev:all"
echo ""
