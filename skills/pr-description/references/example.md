# Example PR description

A complete example, for a fictional change to a web app. Match the tone and depth, not the content.

Title: `fix(checkout): stop double charges when the pay button is clicked twice`

```markdown
## Why?

Customers who clicked "Pay" twice on a slow connection were sometimes charged twice. Support handled 14 refund requests for this last month (SUP-482), and each one takes a manual refund in the payment dashboard.

## Impact

- Customers can no longer be charged twice for one order, however many times they click.
- Support no longer needs to issue refunds for duplicate charges.
- No change to the checkout flow customers see, apart from the button showing "Processing…" while a payment is in progress.

## Technical Impact

- The checkout API now requires an idempotency key per order; the payment provider rejects a repeat request with the same key, so a retry returns the first result instead of charging again.
- The key is the order ID plus attempt number, stored on the `payments` table (new nullable column, backfilled as null; no downtime).
- Trade-off: a deliberate second payment for the same order now needs a new attempt number. Considered a client-side lock only, but it doesn't cover retries from the server or the network.
- Older mobile clients that don't send the key keep working; the server generates one for them.

## Changelog

- fix(checkout): send an idempotency key with every charge, so repeat requests don't charge twice
- feat(checkout): disable the pay button while a payment is in progress, to avoid accidental double clicks
- feat(db): add payments.idempotency_key to record the key used for each charge
- test(checkout): cover double clicks and server retries against the provider's test mode

## Validation

- [x] `npm run lint` and `npm run typecheck`: pass
- [x] `npm test`: 412 tests pass, including 6 new ones for repeated charges
- [x] CI: all checks pass on commit 3f2a9c1
- [x] Migration applied and rolled back on a local copy of the schema

## Dev Test

- [x] Local, provider test mode: clicked "Pay" five times quickly; one charge in the provider dashboard, order paid once.
- [x] Local: killed the server mid-request and retried; the retry returned the original charge.
- [ ] Not tested on the iOS app: the release build isn't available yet; covered by the server-generated key.

## References

- Support ticket SUP-482 (duplicate charge reports)
- Payment provider docs: idempotent requests
- Earlier attempt with a client-side lock: #1287 (closed)
- RCA: "Duplicate charges, March" in the team wiki
```
