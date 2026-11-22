# P1 — AI + human customer support pilot (separate venture)

Status: DRAFT (2026-11-22)
Author: spec-writer · Approved by: <owner, not yet>
Research brief: `docs/research/2026-11-22-ai-customer-support-service.md`

> This is a **separate venture** from the Totallydifferent store. Template sections that assume store
> sales channels (brands, Yoco, creator codes) are marked "n/a: separate venture" or replaced by the
> equivalent: how each paying client, each resolved conversation and each hour is counted.
> Totallydifferent is used only as a free demo and case study.

## 1. The idea
- **In the owner's words (paraphrased):** an "AI virtual customer support" service for online store
  owners worldwide. AI answers the store's customers by chat and email, his call-centre-trained human
  agents handle what the AI can't, and it is set up plug-and-play after collecting the store's information.
- **Mechanical rule (one sentence):** for a fixed monthly fee, put an off-the-shelf AI agent on the
  client store's own helpdesk account, tune its answers every week, and have the owner personally
  handle every conversation the AI hands off, during agreed hours, for 30 days.
- **Owner's model (confirmed 2026-11-22):** the owner is the support agent and uses AI to do the work:
  AI-assisted human support, with the owner as the face of the service. Target clients: US, UK and
  other international stores.
- **What is NOT being tested:** building an AI model, a training bootcamp for agents, hiring agents,
  or a one-off chatbot setup (the brief shows setup alone sells for about $50-$400 on Fiverr and is not
  a business).
- **Channel:** n/a: separate venture. Client acquisition is direct outreach by the owner (see section 2).
- **Brand(s):** n/a: separate venture. Totallydifferent appears only as the demo.
- **Already tested?** No. `research/ideas.md` was empty and `research/specs/` had no specs before this
  one. The only earlier work is the research brief above, whose proposed pass rule is adopted and
  tightened here.

## 2. Counting — how each client, conversation and hour is recorded
(Replaces "Attribution". Nothing here goes through the Totallydifferent store or its database.)

| What is counted | How it is recorded | Can it be recorded today? |
|---|---|---|
| Store approached | Owner's outreach log, one row per store: date, store URL, country, helpdesk used, est. monthly tickets, channel (email / LinkedIn / Shopify community / referral), message sent | Yes, a spreadsheet. Not yet created |
| Reply / call / paid | Same row: date of first reply, positive or negative, call booked, invoice sent, invoice **paid and cleared** | Yes, same sheet |
| Paying client | Counts only when the pilot invoice is paid in full and the money has cleared in his account. A verbal yes, a free trial or a discount below the floor in section 5 does **not** count | Yes, bank / payment-provider statement |
| Renewal | Client pays a second-month invoice at the full price within 7 days of the pilot ending | Yes, statement |
| Conversation | Every customer conversation in the client's helpdesk during the pilot (chat + email), from the helpdesk's own report export | Depends on the client's helpdesk. Check at sign-up that it can export counts |
| AI-resolved conversation | The helpdesk's own definition (e.g. Gorgias: no human reply within 72 h), **plus** the owner's weekly audit of 20 random AI-resolved conversations per client, marking each correct / wrong / should-have-escalated | Helpdesk: depends on tool. Audit: yes, a sheet |
| Human-handled conversation | Everything handed off to, or answered by, the owner | Helpdesk export |
| Customer satisfaction (CSAT) | Helpdesk's built-in CSAT survey if the client has one switched on; otherwise "not measured" (do not invent a survey mid-pilot) | Depends on client |
| Owner hours | Time log per client, in 15-minute blocks: setup, tuning, escalations, client calls, outreach (outreach logged against the venture, not a client) | Yes, a sheet or a free timer. Not yet created |
| Costs | AI-tool fees he pays (if any), payment-receiving and FX fees from the actual statement, legal/tax advice, demo tool | Yes, statements |

Build task: none in this repository. The three logs (outreach, hours, audit) are spreadsheets the owner
keeps. Agents do not contact stores or send anything (CLAUDE.md: the owner sends, posts, signs and pays).

## 3. Outcome and baseline
**Outcomes measured:**
1. Paying clients out of stores approached (the demand test).
2. Renewal after 30 days at full price.
3. AI resolution rate per client = AI-resolved / all conversations, after removing audited
   "wrong" or "should-have-escalated" answers from the AI-resolved count (extrapolated from the audit sample).
4. Wrong-answer rate from the weekly audit.
5. CSAT, and first-response time, per client.
6. Owner hours per client per month.
7. Gross margin per client in rand, after every cost in section 5.

**Baseline for demand ("no interest" looks like this):** fewer than 2 of the first 20 stores approached
pay. Funnel reference points to read alongside it (not pass gates): replies / 20, calls / 20, paid / 20.
Zero or one paid out of 20, or paid only at a price below the floor, is a "no interest" result.

**Baseline for support quality:** each client's own helpdesk stats for the 30 days **before** the pilot
(ticket volume, first-response time, CSAT if measured, and the store's own estimate of hours spent on
support). Collected at sign-up, before any change is made. If a client cannot export this, record
"no baseline" for that client; its quality outcomes are then descriptive only.

## 4. Control
- **There is no true control.** With 2-3 clients, nothing can be randomised: the AI cannot be switched off
  for a random half of customers without hurting the client, and there is no matched group of stores.
  This is said plainly so the result is not over-read.
- **Comparison 1 (before/after, per client):** the client's own previous 30 days (section 3). Weak,
  because seasons and promotions change volume and tone (see confounders).
- **Comparison 2 (price check, market):** what the client would pay for the cheapest alternative from the
  brief: the AI tool alone at about $0.75-$1.25 per resolution, or human outsourcing at about $8-$35/hour.
  If a client could get the same result from the AI tool alone, the human layer is not earning its price.
  Record per client: "AI fees alone would have been $X this month."
- **Comparison 3 (demand, internal):** the outreach funnel itself; the 20-store denominator is fixed
  before outreach starts, so a slow trickle of yeses cannot be counted against a shrinking list.

## 5. Pass rule (fixed before any result is seen)
The pilot **passes only if every gate below passes.** Any one failing = stop or rethink (as the brief says).
Money thresholds are for the owner to set; proposed defaults are in brackets.

| # | Gate | Threshold |
|---|---|---|
| G1 | Demand | At least **2 of the first 20** stores approached pay the pilot invoice, at or above the price floor |
| G2 | Price floor | Pilot price **[owner to set; default $399/month, about R6,755 at R16.93]**, within the brief's $299-$599 range. Any client paying below the floor does not count toward G1 |
| G3 | AI resolution | **At least 50%** per client (not pooled), audit-corrected, in **both** halves of the pilot: days 8-19 and days 20-30. Days 1-7 are setup and are reported but not judged |
| G4 | Wrong answers | Audit wrong-answer rate **[owner to set; default at most 5%]** per client in each half, and **zero** wrong promises of refunds, money or delivery dates that the client had to honour |
| G5 | Owner hours | Ongoing work **under 15 hours per client per month** (brief), and one-off setup **[owner to set; default at most 10 hours]** per client |
| G6 | Gross margin | Per client, after every cost below: **[owner to set; default at least R2,500/month and at least 40% of the fee]** |
| G7 | Customer experience | CSAT not lower than the client's pre-pilot CSAT by more than **[owner to set; default 0.2 on a 5-point scale or 5 percentage points]**, and first-response time not slower than before. If the client had no CSAT before, CSAT must be at least **[default 4.0/5 or 80% positive]** where measured |
| G8 | Renewal | At least **half of pilot clients, and at least 1**, pay month 2 at full price |

**Every cost counted in G6** (rand, at the rate actually received, not mid-market):
- AI-tool fees, if he pays them. Default design: the **client pays its own AI fees** on its own account
  (about $0.75-$1.25 per resolution; Tidio Lyro about $39 per 50 conversations). If he pays them, they
  are a cost here.
- Owner hours (setup + ongoing + client calls) valued at **R72/hour** (brief: experienced SA agent,
  fully loaded, unverified). Also report the margin at **[owner to set; default R150/hour]** as his own
  management rate, because R72/hour undervalues a manager's time.
- Payment-receiving and FX fees (PayPal / Wise / Payoneer / bank). **Unverified**; use the actual
  statement. Planning placeholder: 4% of the invoice.
- FX risk: also report margin at the brief's 52-week low, **R15.67/$**.
- Share of one-off costs: lawyer review of the service agreement, tax practitioner advice, any demo tool
  fee, split across pilot clients.

**Worked example (estimate, not a result):** $399 fee = R6,755. Fees at 4% = R270. 15 h ongoing + 10 h
setup = 25 h x R72 = R1,800. Client pays AI fees. Margin about **R4,685 (69%)**. At R150/h: about
R2,735 (40%). If he paid 150 AI resolutions at $1 himself (about R2,540), the R72/h margin falls to
about R2,145 (32%) and G6 fails at the default, which is why the client should pay AI fees directly.

**Confounders to record, per client and per half:**
- **Black Friday (27 Nov 2026) / Cyber Monday (30 Nov) and December holidays:** ticket volume and
  "where is my order" questions spike; January brings returns. A pilot starting in Dec-Jan is not
  comparable to the client's previous month. Prefer a pilot that starts **after mid-January 2027**, or
  compare against the same month last year if the client has it.
- **Client's own promotions, launches and courier problems** during the pilot (ask weekly).
- **SA public holidays** affecting his availability: 16 Dec, 25-26 Dec, 1 Jan, 21 Mar, Good Friday and
  Family Day (Easter 2027), 27 Apr, 1 May. Escalations still need cover on those days.
- **Load-shedding or internet outages** in Durban, if they return: log every hour he could not work.
  Escalation response time must include those hours.
- **Time zones:** SA (UTC+2) covers UK/EU daytime; US evenings are uncovered. Agree hours in writing.
- **Month-end payday (~25th) and SA school terms:** not relevant to overseas clients' customers; note
  only if a client is South African.

## 6. Clients, conversations and readings, and chance passes
- **Count:** 20 stores approached; 2-3 pilot clients; 8 gates per client; 2 halves per client for G3/G4.
- **Expected passes by chance:** not a statistical test. With 2-3 clients, one client passing a gate is
  an anecdote. Requiring **all 8 gates**, **per client**, in **both halves** is what protects against a
  fluke: one lucky week or one easy store cannot carry the result.
- The 20-store list, the price floor and the thresholds are written down before outreach and are not
  changed afterwards. Stores added to the list after outreach starts count as "next 20", not this test.

## 7. Sample size and budget
**What 2-3 clients can show:**
- Whether *anyone* will pay at this price, whether one person can deliver it inside 15 hours per store,
  and whether the margin is positive with real fees. That is all.

**What it cannot show:**
- A reliable conversion rate. 2 of 20 is 10%, but the honest range is roughly 1%-32% (95% exact
  interval). Even 0 of 20 cannot rule out a true rate up to about 17%.
- That the service works for stores in general, or that it scales to hired agents (he does all human
  work in the pilot).
- Long-term retention. One renewal is a signal, not churn data.

**Per-client minimum:** a client's G3/G4 reading counts only if it has **at least 100 conversations in
days 8-30** (at 100, a 50% rate is only known to about +/-10 points). Below that, mark the client
"too few to read". If no client reaches 100, the pilot answers only the demand and hours questions.

**If the budget or calendar cannot reach this:** shrink the question to **G1 + G2 only** (will 2 of 20
stores pay?) and stop there.

**Budget (rand):**
- Spend cap **[owner to set; default R5,000]** for: lawyer review of a one-page agreement with a data
  processing clause, a tax practitioner consult, and any demo AI-tool fee. No paid ads, no hiring.
- Owner time: outreach (est. 20 stores x 30 min = 10 h) + up to 25 h per client. Recorded, not paid.

## 8. Out of scope
- No AI model building, no bootcamp, no hiring agents, no paid ads.
- No spend beyond the approved cap. No agent contacts any store or sends anything; the owner does all outreach.
- Thresholds, the 20-store list and the price floor are not tuned after results are seen.
- No change to the Totallydifferent checkout, prices, stock or Paystack for this venture.
- No real Totallydifferent customer data in the demo (use made-up demo orders).

## 9. Build plan (for the builder)
- **Nothing for this repository in the pilot itself.** Logs are the owner's spreadsheets.
- **Demo (later, separate spec):** an off-the-shelf AI agent on Totallydifferent's chat once the store is
  live (UI build step 5 is not done yet). Any order lookup via `GET /api/orders/:ref` is a later builder
  spec, needs `checkout-guardian`, and must not let the bot reveal buyer name or email to someone who
  only knows an order ref. Until then, the demo is a recorded video with demo data.

**Risks to clear before the first paid client (not checked by any agent; professional advice needed):**
1. **POPIA (SA):** section 72 limits sending personal data out of SA; use a data transfer agreement.
2. **GDPR (EU/UK clients):** he is a processor; needs an Art. 28 processor agreement and a transfer
   mechanism (e.g. standard contractual clauses). **Unverified; confirm with a privacy lawyer**, or
   exclude EU/UK stores from the pilot.
3. **Work only inside the client's own helpdesk account** so customer data never sits on his systems.
4. **Liability:** agreement must say the store's policies are the source of truth and cap his liability
   for AI answers. Not legally checked.
5. **Registration and tax:** a sole proprietor needs no CIPC registration, but whether overseas clients
   will contract with one is unverified; foreign income must be declared, likely as a provisional
   taxpayer; exchange-control treatment of USD receipts is unverified. Ask a tax practitioner.
6. **Foreign payments:** receiving fees and FX spread for PayPal / Wise / Payoneer / SA banks are
   unverified; open and test the receiving route before invoicing.
7. **Competitor facts** (Simplr shutdown, vendor prices) are from third-party or snippet sources only.

## 10. Open questions for the owner
1. Price floor for the pilot (default $399/month), and is a setup fee charged on top?
2. Gross-margin floor per client (default R2,500 and 40%) and your own hourly rate for the second
   margin line (default R150/h).
3. ~~Which markets?~~ **Answered 2026-11-22: US, UK and other international.** So risk 2 (UK GDPR
   paperwork) applies and cannot be avoided, and US coverage hours must be agreed in writing.
4. Start date: before or after the Dec-Jan season (default: pilot starts after mid-January 2027)?
5. Spend cap for legal, tax and the demo tool (default R5,000)?
6. Sole proprietor or (Pty) Ltd for the pilot?
