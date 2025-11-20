# Production Deployment Commands

## Issue Resolution: PostgreSQL Authentication + Schema Migration

### Problem
1. Peer authentication error when connecting to PostgreSQL
2. Foreign key constraint violation in ClassEnrollment table

### Solution
Use `sudo -u postgres` to bypass authentication and clean orphaned data before schema push.

---

## Complete Deployment Command (Copy-Paste Ready)

```bash
cd /var/www/s7/server && \
sudo -u postgres psql s7_prod -c "DELETE FROM \"ClassEnrollment\" WHERE \"classId\" NOT IN (SELECT id FROM \"ClubClass\");" && \
npx prisma db push --schema ../prisma/schema.prisma && \
npx prisma generate --schema ../prisma/schema.prisma && \
cd /var/www/s7 && \
git fetch origin && \
git reset --hard origin/main && \
npm ci && \
npm run build && \
cd server && \
npm ci && \
npm run build && \
pm2 restart s7-backend && \
pm2 restart s7-frontend && \
pm2 status
```

---

## Step-by-Step Commands (If Single Command Fails)

### 1. Clean Database
```bash
cd /var/www/s7/server
sudo -u postgres psql s7_prod -c "DELETE FROM \"ClassEnrollment\" WHERE \"classId\" NOT IN (SELECT id FROM \"ClubClass\");"
```

### 2. Apply Database Schema
```bash
npx prisma db push --schema ../prisma/schema.prisma
npx prisma generate --schema ../prisma/schema.prisma
```

### 3. Update Frontend
```bash
cd /var/www/s7
git fetch origin
git reset --hard origin/main
npm ci
npm run build
```

### 4. Update Backend
```bash
cd /var/www/s7/server
npm ci
npm run build
```

### 5. Restart Services
```bash
pm2 restart s7-backend
pm2 restart s7-frontend
pm2 status
```

### 6. Verify Deployment
```bash
pm2 logs s7-backend --lines 50
pm2 logs s7-frontend --lines 50
```

---

## Alternative: Interactive Database Cleanup

If you need to inspect data before deletion:

```bash
# Connect to database
sudo -u postgres psql s7_prod

# Check orphaned records count
SELECT COUNT(*) FROM "ClassEnrollment" ce 
LEFT JOIN "ClubClass" cc ON ce."classId" = cc.id 
WHERE cc.id IS NULL;

# View orphaned records
SELECT ce.id, ce."classId", ce."userId" 
FROM "ClassEnrollment" ce 
LEFT JOIN "ClubClass" cc ON ce."classId" = cc.id 
WHERE cc.id IS NULL;

# Delete orphaned records
DELETE FROM "ClassEnrollment" 
WHERE "classId" NOT IN (SELECT id FROM "ClubClass");

# Exit
\q
```

---

## Troubleshooting

### If Prisma Push Still Fails
```bash
# Check for other orphaned records
sudo -u postgres psql s7_prod

SELECT tablename FROM pg_tables WHERE schemaname = 'public';

# Check all foreign keys
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE '%Enrollment%';

\q
```

### If Services Don't Restart
```bash
# Check PM2 status
pm2 list

# Force restart
pm2 restart s7-backend --update-env
pm2 restart s7-frontend --update-env

# If still failing, delete and recreate
pm2 delete s7-backend
pm2 delete s7-frontend

cd /var/www/s7/server
pm2 start npm --name "s7-backend" -- start

cd /var/www/s7
pm2 start npm --name "s7-frontend" -- start

pm2 save
```

### Check Application Logs
```bash
# Backend logs
pm2 logs s7-backend --lines 100

# Frontend logs  
pm2 logs s7-frontend --lines 100

# System logs
journalctl -u nginx -n 50

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

---

## Post-Deployment Verification

### 1. Check Services
```bash
pm2 status
# Both services should show "online" status
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:4000/health

# Test club endpoint
curl http://localhost:4000/api/clubs/mine -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Check Frontend
```bash
# Should return HTML
curl http://localhost:3000
```

### 4. Test in Browser
- Navigate to https://s7robotics.space
- Open browser console (F12)
- Test club creation
- Test video playback
- Check for console errors

---

## Rollback Instructions

If deployment causes issues:

```bash
# View recent commits
cd /var/www/s7
git log --oneline -10

# Rollback to previous commit
git reset --hard <previous-commit-hash>

# Rebuild
npm ci && npm run build
cd server && npm ci && npm run build

# Restart
pm2 restart all
```

---

## Summary

**What This Does:**
1. Cleans orphaned ClassEnrollment records
2. Applies Prisma schema changes
3. Regenerates Prisma client
4. Pulls latest code from Git
5. Rebuilds frontend and backend
6. Restarts both services

**Expected Duration:** 2-5 minutes

**Zero Downtime:** No (brief service interruption during restart)

**Data Loss Risk:** Minimal (only orphaned records removed)
