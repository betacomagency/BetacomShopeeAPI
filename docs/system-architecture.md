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

## Monitoring & Observability

### Architecture

Monitoring app deployed separately to Vercel (`/monitoring` folder) provides system health visibility, API analytics, business metrics, user activity tracking, and request tracing.

```
┌─────────────────────┐     ┌──────────────────────┐
│ Monitoring App      │────►│ Supabase RPC         │
│ (Vercel)            │     │ 5 Functions:         │
│ /health             │     │ - get_system_health  │
│ /api                │     │ - get_api_analytics  │
│ /business           │     │ - get_business_...   │
│ /activity           │     │ - get_user_activity  │
│ /trace              │     │ - trace_request      │
└─────────────────────┘     └──────────────────────┘
         │
         └─────────────────────────────────────────┐
                                                  │
                          ┌───────────────────────▼───────────┐
                          │ Supabase Postgres Tables          │
                          │ health_check_logs (30d retention)│
                          │ api_call_logs (90d retention)    │
                          │ system_activity_logs (180d)      │
                          └──────────────┬────────────────────┘
                                         │
                          ┌──────────────▼────────────┐
                          │ EC2 Worker Cron Jobs      │
                          │ → Health heartbeat (5min) │
                          └───────────────────────────┘
```

### RPC Functions (Dashboard Metrics)

| RPC | Purpose |
|-----|---------|
| `get_system_health()` | Worker status, edge function uptime, token health |
| `get_api_analytics(hours, function, shop_id)` | Call volumes, error rates, latency p95, top errors |
| `get_business_metrics()` | Shop counts, flash sale success rate, job queue status |
| `get_user_activity(hours, user_id)` | Activity timeline, users summary, actions by category |
| `trace_request(request_id)` | Full request chain: frontend → edge functions → API logs |

### Request ID Tracing

Every API request flows with `x-request-id` header:

```
Frontend (supabase-client.ts)
  │ x-request-id: UUID
  ▼
Edge Function (apishopee-proxy, flash-sale, etc.)
  │ reads x-request-id
  │ inserts into api_call_logs.request_id
  ▼
api_call_logs table
  │ allows searching full request chain
  ▼
Monitoring /trace page: search by UUID → see all logs
```

### Health Checks

Worker writes heartbeat to `health_check_logs` every 5 minutes:

```json
{
  "component": "worker",
  "status": "healthy",
  "metadata": {
    "uptime": 123456,
    "memory_mb": 45,
    "crons": {
      "flash_sale_scheduler": {"last_run": "2026-03-28T14:30:00Z", "status": "success"},
      "flash_sale_sync": {"last_run": "2026-03-28T14:35:00Z", "status": "success"},
      "token_refresh": {"last_run": "2026-03-28T14:34:00Z", "status": "success"}
    }
  }
}
```

### Log Retention

- `health_check_logs`: 30 days (cron: weekly cleanup)
- `api_call_logs`: 90 days (cron: weekly cleanup)
- `system_activity_logs`: 180 days (existing)

### Real-time Updates

Monitoring app uses Supabase Realtime on `health_check_logs` for live health dashboard updates. Critical events (Worker down, error rate > 5%) trigger toast notifications.

## Deployment

### Frontend
```bash
git push  # Vercel auto-deploys from main branch
```

### Monitoring App
```bash
# Separate Vercel project linked to /monitoring folder
git push  # Auto-deploys to monitoring.betacomshopee.com
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
