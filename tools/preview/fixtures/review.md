=== user ===
Review the cache change before I merge it.

=== agent ===
# Review: read-through cache for product pages

**Verdict: don't merge yet.** One bug loses writes; the rest is small.

## 1. Stale entry after a failed write

`update()` deletes the cache entry *before* the database write. When the write fails, the next read repopulates the cache from the old row, which is fine, but a concurrent reader in between caches the old row **with the new TTL**:

```
t0  writer   cache.del(key)
t1  reader   db.get(key)        -> old row
t2  writer   db.put(key, new)   -> fails
t3  reader   cache.set(key, old row, ttl = 1h)
```

Delete after the write succeeds, and keep the delete in a `finally` only for the timeout case.

## 2. Smaller points

- `ttlSeconds` is read from the environment on every call. Read it once at start-up.
- The key is built with string concatenation:
  - `product:` + id works today,
  - but a tenant prefix is coming, and `tenant:product:id` collides with a product named `product`.
  - Use the existing `cacheKey(tenant, kind, id)` helper.
- The new test sleeps for 1.1 s to cross the TTL. Inject the clock instead.

## 3. What I checked

1. Ran the suite 20 times: no flakes.
2. Killed the database mid-write by hand and reproduced the stale read above.
3. Read the two callers of `update()`; neither retries.

> I did not load-test this. The hit rate claim in the description (≈ 92 %) comes from the author's laptop.

Fix point 1 and I'd approve. Points 2 and 3 can follow.
