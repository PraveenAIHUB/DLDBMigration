@echo off
echo ==================================================
echo   Car Bidding Platform - Database Setup
echo ==================================================
echo.

echo Generating Prisma client...
call npm run prisma:generate > nul 2>&1
if %errorlevel% neq 0 (
    echo Failed to generate Prisma client
    exit /b 1
)
echo Prisma client generated
echo.

echo Running database migrations...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo Migrations failed
    exit /b 1
)
echo Migrations completed
echo.

echo Creating admin user...
call npx tsx scripts/create-admin-direct.ts
echo.

echo ==================================================
echo Setup Complete!
echo ==================================================
echo.
echo Login URL:  http://localhost:5173/admin
echo Email:      admin@carbidding.com
echo Password:   admin123
echo.
echo Start the application:
echo   npm run dev:all
echo.
pause
