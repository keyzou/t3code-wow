=== user ===
show me the awkward cases

=== agent ===
# Heading one
## Heading two
### Heading three with `code` and **bold**

A paragraph with **bold**, *italic*, ***both***, ~~struck~~, `inline code`, a [link](https://example.com/docs/getting-started), a link to [the parser](packages/importer/src/parse/rows.ts:42), **`bold code`**, a bare address https://github.com/example/shop/blob/main/packages/importer/src/parse/rows/quantity.test.ts#L120-L188 and an escaped \*star\*. Symbols: ✅ done, ❌ failed, ⚠️ careful, 🚀 shipped, → next, 1️⃣ first, ≥ 3, ± 1, 5 − 2.

1. First step
   with a second line of the same item.

   A further paragraph of the first step.

   ```sh
   npm run build -- --filter importer
   ```
2. Second step
   - nested bullet
     - deeper bullet with a long line that has to wrap inside its own indent so the continuation lines up with the text above it
       - deepest
3. Third step

| Setting | Default | What it does when the value is long enough to need more than one line in its column |
|---|:-:|---|
| `importer.batchSize` | 500 | Rows written per transaction. Larger is faster until the lock timeout, which is 30 s on staging. |
| `importer.skipBundles` | true | Leave out rows with a blank quantity. |
| `importer.retry.maxAttempts` | 3 | Network errors only. |

```
src/
├── parse/
│   ├── rows.ts
│   └── quantity.test.ts
└── index.ts   a_very_long_line_of_code_that_does_not_fit_in_the_column_and_has_no_spaces_to_break_at_until_here and then some more
```

> A quote with **bold** and `code`.
>
> Its second paragraph.

Final line with a_snake_case_name, 2 * 3 * 4, and C:\Users\me\file.txt.
