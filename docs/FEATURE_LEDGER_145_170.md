# BizStack feature implementation ledger — current 145–170 block

Legend: End-to-end = usable workflow exists without pretending external systems are configured. Provider-bound = the product workflow is implemented, but external delivery/provider credentials are intentionally required. Partial = durable foundation exists but additional workflow/UI/provider work remains.

| # | Capability | Current state | Real implementation |
|---|---|---|---|
| 145 | Supplier smart pricing alerts | End-to-end foundation | Supplier/product cost history, price-change builder, alert/event path |
| 146 | Cash sales + daily reconciliation | End-to-end foundation | Register, cash sale, stock decrement, reconciliation |
| 147 | Dual-currency books | Partial | Base/secondary currency configuration and FX-ready transaction fields |
| 148 | Agent/broker commissions | End-to-end foundation | Agent commission calculation, payable/payout ledger |
| 149 | AI business plan / grant drafts | End-to-end foundation | Structured document compiler with evidence/assumption boundary |
| 150 | Loan-readiness + lender pack | Partial | Recorded-data readiness calculation and lender checklist/profile |
| 151 | Rent/landlord scheduling | Partial | Recurring obligation engine supports rent and due dates |
| 152 | Payroll advances | End-to-end foundation | Workforce member match, advance, recovery terms and outstanding balance |
| 153 | Ajo/esusu/thrift | Partial | Groups, members, contribution ledger and durable rules |
| 154 | Cold-storage / utility tracking | Partial | Obligation types + due-date tracking |
| 155 | Fleet expense log | Partial | Fleet obligation category + transaction path |
| 156 | Generator/fuel cost tracking | Partial | Generator/fuel obligation + carbon activity support |
| 157 | Bulk SMS credit wallet | Provider-bound | Real credit wallet/ledger; external top-up/delivery provider required |
| 158 | AI phone answering | Provider-bound | Voice agent, call ledger, escalation/tool boundary; telephony/AI provider required |
| 159 | QR menu + kitchen flow | Partial | QR-ready menu, items, kitchen order schema; public ordering flow still expandable |
| 160 | Appointment booking + deposits | End-to-end foundation | Service creation, customer match, collision check, deposit calculation |
| 161 | Waiver/consent + signature | Partial | Versioned waivers and signature records; capture UI/provider still expandable |
| 162 | AI product photo studio | Provider-bound | Product-linked media jobs, generation brief compiler and provider worker |
| 163 | WhatsApp/SMS broadcast with opt-out compliance | End-to-end foundation | Consent records, recipient blocking, approval workflow, provider delivery and delivery ledger |
| 164 | Business credit building | Partial | Transparent internal score from documented BizStack evidence |
| 165 | Successor/emergency access | Partial | Delayed grant records and permission boundary; activation/identity handoff still expandable |
| 166 | Compliance calendar | End-to-end foundation | Jurisdiction/due date/recurrence/priority/evidence records |
| 167 | Carbon footprint report | Partial | Activity ledger and explicit-factor CO2e calculation |
| 168 | Fractional CFO AI | Partial | Deterministic finance snapshot, receivables/risk/recommendations |
| 169 | B2B community marketplace | End-to-end foundation | Listings, discovery, seller publishing, buyer inquiries and participant RLS |
| 170 | Finance API for schools/churches/cooperatives | End-to-end foundation | Scoped clients, hashed one-time keys, customer/transaction/invoice/report endpoints, revocation, OpenAPI |

The remaining provider-bound or partial labels are deliberate: external credentials, public ordering, identity activation, signature capture, image generation, and similar external actions are not fabricated as successful until the corresponding service is actually connected.
