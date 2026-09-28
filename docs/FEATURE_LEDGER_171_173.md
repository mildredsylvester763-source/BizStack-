# BizStack feature ledger — intelligence extensions

| # | Capability | State | What is implemented |
|---|---|---|---|
| 171 | AI cash-flow alerting | End-to-end foundation | Lifetime posted cash position, 30-day operating trend, receivables due inside the alert horizon, projected outflows, configurable safety buffer, severity and explanation API, dashboard radar |
| 172 | WhatsApp order capture | End-to-end foundation | Message parser, SKU/name matching, stock validation, line totals, unresolved-item review state, durable event ledger, API endpoint and dashboard test flow |
| 173 | Voice-of-customer dashboard | End-to-end foundation | Feedback ingestion, rating-derived sentiment, deterministic theme clustering, ranked topic counts, positive/negative breakdown, API and dashboard workspace |

Provider connections remain separate from the business logic. A real WhatsApp provider can feed the order endpoint later without changing the parsing and inventory-resolution core.
