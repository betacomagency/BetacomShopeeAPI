---
status: completed
priority: high
complexity: low
estimated_effort: 1h
completed_at: 2026-03-17
---

# Fix Flash Sale Empty Items Issue

## Problem Statement

~10-20% of scheduled Flash Sales appear empty on Shopee despite backend marking job as `success`. Root cause: `fail_list` from Shopee API response is not being checked.

## Root Causes (from Brainstorm)

| ID | Cause | Location | Impact |
|----|-------|----------|--------|
| RC1 | `fail_list` not processed | Line 778-789 | Primary cause - items rejected silently |
| RC2 | Default count = request count | Line 762 | Wrong count when `success_list` undefined |
| RC4 | `item_stock = 0` allowed | Line 427, 437, 447 | Shopee rejects stock < 1 |

## Solution Overview

Implement strict response validation following YAGNI/KISS:

1. **Check `fail_list`** - Process failed items and log reasons
2. **Fix default count** - Always use `success_list.length`
3. **Set stock minimum** - Ensure `item_stock >= 1`
4. **Alert on partial** - Extend existing alert for partial failures

## File Changes

| File | Changes |
|------|---------|
| `supabase/functions/apishopee-flash-sale-scheduler/index.ts` | All changes |

## Implementation Phases

### Phase 1: Fix fail_list Handling (P0)

**Location:** Lines 778-789

**Current:**
```typescript
} else {
  message += ` với ${itemsToAdd.length} sản phẩm`;
  const addResponse = addResult as { response?: { success_list?: unknown[] } };
  if (addResponse.response?.success_list) {
    addedItemsCount = addResponse.response.success_list.length;
    if (addedItemsCount < itemsToAdd.length) {
      finalStatus = 'partial';
      message = `Đã tạo Flash Sale #${newFlashSaleId} với ${addedItemsCount}/${itemsToAdd.length} sản phẩm`;
    }
  }
}
```

**Fixed:**
```typescript
} else {
  // Define proper type for fail_list items
  interface FailedItem {
    item_id: number;
    fail_error?: string;
    fail_message?: string;
  }

  const successList = addResult.response?.success_list || [];
  const failList = (addResult.response?.fail_list || []) as FailedItem[];

  addedItemsCount = successList.length;

  if (failList.length > 0) {
    // Log detailed failure info
    console.error(`[SCHEDULER] ${failList.length} items FAILED for FS #${newFlashSaleId}:`, JSON.stringify(failList));

    finalStatus = successList.length === 0 ? 'error' : 'partial';
    message = `FS #${newFlashSaleId}: ${successList.length}/${itemsToAdd.length} items added (${failList.length} failed)`;

    // Store fail reasons for debugging (truncate if too long)
    const failReasons = failList.slice(0, 5).map(f => `${f.item_id}: ${f.fail_error || 'unknown'}`).join('; ');
    if (failList.length > 5) {
      message += ` | Errors: ${failReasons}... (+${failList.length - 5} more)`;
    } else {
      message += ` | Errors: ${failReasons}`;
    }
  } else if (successList.length === 0 && itemsToAdd.length > 0) {
    // No success_list and no fail_list but we sent items - unexpected
    console.warn(`[SCHEDULER] Unexpected: sent ${itemsToAdd.length} items but got empty response`);
    finalStatus = 'partial';
    message = `FS #${newFlashSaleId}: Response missing success/fail lists`;
  } else {
    message = `Đã tạo Flash Sale #${newFlashSaleId} với ${addedItemsCount} sản phẩm`;
  }
}
```

### Phase 2: Fix item_stock Minimum (P1)

**Location:** Lines 427, 437, 447

**Changes:**
```typescript
// Line 427: Non-variant with model
item_stock: Math.max(model.campaign_stock || 1, 1),

// Line 437: Non-variant without model
item_stock: Math.max(item.campaign_stock || 1, 1),

// Line 447: Variant models
stock: Math.max(m.campaign_stock || 1, 1),
```

### Phase 3: Alert on Partial Failures (P1)

**Location:** After line 803 (before return)

**Add:**
```typescript
// Send alert for partial failures (not just errors)
if (finalStatus === 'partial' || finalStatus === 'error') {
  await sendFailureAlert(job, message);
}
```

**Note:** Also update return statement to reflect partial:
```typescript
return { success: finalStatus === 'success', message, flashSaleId: newFlashSaleId };
```

## Testing Checklist

- [ ] Deploy updated function
- [ ] Create scheduled job with known-invalid items (e.g., stock=0)
- [ ] Verify job shows `status='partial'` or `status='error'`
- [ ] Verify `error_message` contains fail reasons
- [ ] Verify alert webhook fires for partial failures
- [ ] Verify valid items still succeed (no regression)

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Jobs showing wrong `success` | ~10-20% | 0% |
| Fail reasons logged | No | Yes |
| Accurate item counts | No | Yes |
| Alerts for partial | No | Yes |

## Rollback Plan

Revert to previous version of `apishopee-flash-sale-scheduler/index.ts` via git.

## Dependencies

None - self-contained change to scheduler function.

## Notes

- This fix detects failures, doesn't prevent them
- If failure rate remains high after deployment, consider Phase 2 of brainstorm (pre-validation with criteria check)
- Monitor `partial` vs `success` ratio for 1 week after deploy
