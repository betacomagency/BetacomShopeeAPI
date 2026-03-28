# System Architecture

## Overview

BetacomShopeeAPI manages 294+ Shopee shops with automated flash sale creation, token management, and product sync.

## Architecture Diagram

```
                    Users (Browser)
                         |
                    Vercel (SPA)
                   React 19 + Vite
                         |
              Supabase (Database + Auth)
             /           |           \
     Edge Functions    Postgres     Realtime
     (lightweight      (data)      (live updates)
      API proxy,
      auth, CRUD)
                         |
              EC2 Worker (Node.js + PM2)
              t2.micro | IP: 3.0.117.200
             /                    \
     Flash Sale Scheduler      Token Refresh
     (*/2 min, 294 shops)      (*/30 min)
            |                      |
      Shopee Partner API (direct HTTPS, fixed IP)
```

## Components

### Frontend (Vercel)
- **Stack:** React 19, TypeScript, Vite 7, TanStack Query, Radix UI + Tailwind
- **Deploy:** Vercel free (SPA, all routes rewrite to /index.html)
- **Auth:** Supabase Auth (JWT, 1hr expiry)

### Backend (Supabase)
- **Database:** Postgres on Supabase Pro ($25/mo)
- **Edge Functions:** Lightweight API for frontend (proxy, auth, flash sale CRUD, product management)
- **Realtime:** Enabled for flash sale data tables
- **Extensions:** pg_cron (for non-Shopee jobs), pg_net, vault

### EC2 Worker
- **Instance:** AWS EC2 t2.micro (1 vCPU, 1GB RAM, Ubuntu 24.04)
- **Elastic IP:** 3.0.117.200 (whitelisted at Shopee)
- **Process Manager:** PM2 (auto-restart, memory limit 256MB)
- **Purpose:** Long-running batch jobs that exceed Edge Function 150s timeout

#### Worker Cron Jobs
| Job | Schedule | Description |
|-----|----------|-------------|
| Flash Sale Scheduler | `*/2 * * * *` | Process pending flash sale auto-creation jobs |
| Flash Sale Sync | `10,40 * * * *` | Sync flash sale list from Shopee to DB |
| Token Refresh | `0,30 * * * *` | Refresh expiring access tokens (3hr threshold) |

#### Worker Tech Stack
- Node.js 20 LTS + TypeScript
- node-cron (scheduling)
- bottleneck (rate limiting per partner app)
- @supabase/supabase-js (DB access with service_role key)

### Edge Functions (Active)
| Function | Purpose | Called By |
|----------|---------|-----------|
| apishopee-proxy | Sign + proxy Shopee API calls | Frontend |
| apishopee-auth | OAuth flow with Shopee | Frontend |
| apishopee-flash-sale | Flash sale CRUD operations | Frontend |
| apishopee-flash-sale-scheduler | Flash sale auto-scheduler (backup) | Disabled pg_cron |
| apishopee-product | Product management | Frontend |
| apishopee-product-webhook | Shopee push notifications | Shopee |
| apishopee-sync-worker | Single-shop flash sale sync | Frontend |
| shopee-token-refresh | Manual token refresh | Frontend |
| shopee-shop | Shop info | Frontend |
| admin-create-user | Admin user creation | Frontend (admin) |

### Removed Features
- **Reviews sync + auto-reply** — removed (code + DB tables dropped)
- **Ads management** — removed (frontend pages deleted, DB already clean)
- **Escrow/Finance sync** — removed (Edge Function + DB already deleted)
- **Orders sync** — removed previously

## Data Flow

### Flash Sale Auto-Creation
```
1. User schedules flash sale on frontend
2. Row inserted into apishopee_flash_sale_auto_history (status=scheduled)
3. EC2 Worker picks up job every 2 minutes
4. Worker calls Shopee API: create_shop_flash_sale + add_items
5. Updates job status (success/error/retry)
6. Syncs flash sale list back to DB for UI display
```

### Token Refresh
```
1. EC2 Worker checks every 30 minutes
2. Finds shops with tokens expiring within 3 hours
3. Groups by merchant_id (1 API call per merchant group)
4. Calls Shopee auth API to refresh
5. Updates apishopee_shops with new tokens
6. Also refreshes multi-app tokens (apishopee_shop_app_tokens)
```

## Infrastructure

| Service | Cost | Purpose |
|---------|------|---------|
| Supabase Pro | $25/mo | Database, Auth, Edge Functions, Realtime |
| EC2 t2.micro | Free (12 months) | Worker for batch jobs |
| Elastic IP | ~$3.65/mo | Fixed IP for Shopee whitelisting |
| Vercel | Free | Frontend hosting |
| **Total** | **~$29/mo** | |

## Deployment

### Frontend
```bash
git push  # Vercel auto-deploys from main branch
```

### Worker (EC2)
```bash
ssh -i key.pem ubuntu@3.0.117.200
cd /home/ubuntu/shopee-app && git pull && cd worker && pnpm build && pm2 restart shopee-worker
```

### Edge Functions
```bash
supabase functions deploy <function-name>
```
