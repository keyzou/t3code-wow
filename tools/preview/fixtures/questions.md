=== user ===
Can you list the open questions again?

=== agent ===
Here is the full list. Writing it out showed one contradiction in my earlier proposals: Q3 had the importer read prices from the supplier's CSV, while Q4 had the page accept only an order code. Q3 is reworked below.

---

❓ **Q1** - **Stock levels checked against the warehouse**: step 2 computes each item's free stock from its count, its reservations and its pending returns. The warehouse's `stock_on_hand`, relayed by the nightly export, gives its own number for each item.

➡️ Commit each reference order's export file next to its order code. Test every item's free stock against the warehouse's value within ±1. A failure is our bug, or a count changed between the export (2026-10-25) and our 4.2.1 data pack.

---

❓ **Q2** - **The report table names our results**: `ReportColumns` lists the sheet's rows and the final value each row shows (`free_stock`, `reserved_for_orders_%`). It doesn't list which counts feed a row.

➡️ Name every value we calculate by those column ids, and take the page's labels and row order from the table. Fix the wrong sentence in `docs/plan.md`.

---

❓ **Q3 (reworked)** - **What steps 1 and 2 show on screen**:
- Step 1: paste an order code, see the customer, the lines and each line's stock, then the totals with their breakdowns.
- Step 2: adds the warehouses with their items (counted, uncounted and returned), and each value next to the export's.

➡️ Yes. "The export's value" means the value for the current state, plus the saved value when every line is filled. Four other orders run in the report: \_\_ACME\_\_EU, northwind, Alber_Yang (prepaid) and Cuticule.

---

❓ **Q4** - **The page takes an order code**:

➡️ Yes, as story 10 says. A link or a file stays out of scope, as `docs/plan.md` already says.
