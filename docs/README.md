# BetacomShopeeAPI - Documentation

Tài liệu hệ thống đồng bộ dữ liệu Shopee.

---

## Cấu Trúc Tài Liệu

### Reviews & Auto Reply System

#### [auto-reply-quickstart.md](./auto-reply-quickstart.md)
Quick start guide cho hệ thống tự động trả lời đánh giá.

#### [auto-reply-system.md](./auto-reply-system.md)
Chi tiết hệ thống auto-reply.

#### [reviews-sync-mechanism.md](./reviews-sync-mechanism.md)
Cơ chế đồng bộ reviews từ Shopee.

#### [reviews-sync-fixes.md](./reviews-sync-fixes.md)
Các fix đã thực hiện cho reviews sync.

---

## Quick Links

### For Developers

**Hiểu hệ thống**:
1. [auto-reply-system.md](./auto-reply-system.md) - Auto-reply system
2. [reviews-sync-mechanism.md](./reviews-sync-mechanism.md) - Reviews sync

**Deployment & Operations**:
1. [auto-reply-quickstart.md](./auto-reply-quickstart.md) - Auto-reply quickstart

### For DevOps

**Daily Monitoring**:
```sql
-- Check cronjobs
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%review%';
```

### Technologies

- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Frontend**: React + TypeScript
- **Scheduling**: pg_cron
- **API**: Shopee Partner API v2
- **Realtime**: Supabase Realtime

---

## Components

```
┌─────────────────────────────────────────┐
│         BetacomShopeeAPI                │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Reviews Sync System            │  │
│  │  - Incremental sync              │  │
│  │  - Auto reply (cronjob)          │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Monitoring & Analytics         │  │
│  │  - API call logging              │  │
│  │  - Performance metrics           │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## Edge Functions

- `supabase/functions/apishopee-reviews-sync/` - Reviews sync worker
- `supabase/functions/apishopee-auto-reply/` - Auto-reply worker

## Frontend Hooks

- `src/hooks/useRealtimeData.ts` - Realtime subscriptions
- `src/hooks/useAutoReply.ts` - Auto-reply management

---

## Troubleshooting

### Reviews Not Syncing?
1. Check: `SELECT * FROM apishopee_reviews_sync_status WHERE shop_id = <id>;`
2. See: [reviews-sync-fixes.md](./reviews-sync-fixes.md)

### Auto Reply Not Working?
1. Check: `SELECT * FROM apishopee_auto_reply_config WHERE shop_id = <id>;`
2. See: [auto-reply-quickstart.md](./auto-reply-quickstart.md)

---

## Support

**For technical issues**:
- Check relevant documentation first
- Review Edge Function logs: `npx supabase functions logs <function-name>`

**For questions**:
- Contact DevOps team
- Review system architecture in docs

---

## External Resources

- [Shopee Open API Documentation](https://open.shopee.com/documents)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL pg_cron](https://github.com/citusdata/pg_cron)

---

*Last updated: 2026-02-08*
*Maintained by: Development Team*
