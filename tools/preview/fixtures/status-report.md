=== user ===
The import job is failing on staging again. Can you find out why and fix it?

=== agent ===
## What I found

The import job fails because `parseRow()` treats an empty **quantity** as `0` and then divides by it. Three things were involved:

1. The CSV export changed on 2026-11-03 and now leaves `quantity` blank for bundles.
2. `parseRow()` falls back to `0` instead of skipping the row.
   - The fallback was added in `a41c9e2` to silence a type error.
   - Nothing downstream expected a zero.
3. The retry wrapper swallowed the `RangeError`, so the job reported *success* with 0 rows.

### The fix

```ts
export function parseRow(row: RawRow): Row | null {
  if (row.quantity === '') return null; // bundles carry no quantity
  const quantity = Number(row.quantity);
  return { sku: row.sku, quantity, unitPrice: row.total / quantity };
}
```

I also made the retry wrapper rethrow anything that isn't a network error.

### Results

| Check | Before | After | Notes |
|:------|-------:|------:|:------|
| Rows imported | 0 | 12,480 | 312 bundle rows skipped, as intended |
| Job duration | 4 s | 41 s | It now does the work |
| `npm test` | 212 pass | 216 pass | 4 new tests for blank quantities |

### Still open

- [x] Fix `parseRow()` and add tests
- [x] Stop the retry wrapper hiding errors
- [ ] Backfill the three nights that imported nothing
- [ ] Ask the supplier whether bundles will ever carry a quantity

> **Note:** the backfill re-sends stock updates. Run it outside business hours, or the storefront shows stale counts for a few minutes.

✅ Tests pass and the job runs on staging → ready for review. See [the pull request](https://github.com/example/shop/pull/482) and the run log at https://ci.example.com/shop/runs/99812/logs?step=import#L220.
