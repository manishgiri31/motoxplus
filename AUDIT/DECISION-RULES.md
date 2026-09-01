# AUDIT / DECISION RULES

> Save as `AUDIT/DECISION-RULES.md` in the repo and reference it at the start of every audit session:
> "Read `AUDIT/DECISION-RULES.md` and apply it. Decide anything in §2 yourself. Escalate only §3."

These encode the review posture applied across the audit so far. Apply them yourself instead of asking.

---

## 1. Standing principles

1. **Fail closed on money.** When a decision is uncertain and money is involved, pick the option that stops the transaction and routes it to a human, not the one that guesses.
2. **Both directions of money error count.** Under-charging the dealer and over-charging the dealer are both bugs. A fix that trades one for the other is not a fix. Say so if you find yourself proposing one.
3. **Never route a fee, tier, or refund decision through `Order.status` or `normalizeShipmentStatus`.** Those mappings exist for display and workflow, not for money. Read raw carrier data.
4. **Prefer read-only classifiers over write-coupled syncs.** If you need to know something, fetch and classify it. Do not call a function that also writes as a way of getting a read.
5. **No schema changes or new migrations** while H6 (migration drift) is unresolved. If a fix seems to need one, it belongs in Phase 3, not now.
6. **Never point at the production database.** Prod DB is self-hosted Postgres on the VPS
   (`localhost:5432/motoxplus`) — there is no Neon branch. Use only the scratch/restore DB the
   user provides, read-only unless explicitly told otherwise. Every query name-checks the
   scratch DB.
7. **Shared helpers require a blast-radius report before you change them.** Enumerate every consumer, state what else changes, and if the effect reaches beyond the finding's scope, don't make the change — log it and pick a narrower fix.
8. **Label every fix as stopgap or real.** A stopgap that isn't labelled becomes permanent by accident.
9. **Verified means you ran something.** Inference is "suspected". Never present the two as the same thing.
10. **Scope discipline.** Anything you notice outside the current batch gets logged to `AUDIT/01-findings.md` unfixed. Noticing is not a licence to fix.

---

## 2. Pre-authorised — decide these yourself, don't ask

- **Implementation approach**, when more than one option satisfies §1. State which you picked and why in one line, then build it.
- **Correcting my instructions.** If something I specified conflicts with §1 or with a fact you've verified in the code, follow §1 and the code. Say what you changed and why — do not stop and wait.
- **`Setting` keys, defaults, thresholds.** Pick a sensible value, put it in `Setting` rather than a constant, note the default.
- **Test design, factoring, naming, file placement.**
- **Deferring an out-of-scope finding**, with a log entry.
- **Declining to fix something** because the blast radius fails §7 — log it and move on.
- **Which queries to run** on the branch to answer a data-state question, and what they can't prove.

---

## 3. Escalate — these are genuinely mine

Stop and ask only for:

- **Money policy.** Fee percentages, who absorbs a cost, refund eligibility, anything that changes what a dealer is charged as a matter of policy rather than correctness.
- **Schema changes and migrations.** Always, while H6 is open.
- **Anything needing account-side action** — Delhivery config, Razorpay settings, Meta/WhatsApp, DNS, credentials, prod env values.
- **Genuine dilemmas where both options harm someone.** Not "which is cleaner" — that's §2. This means dealer harm vs. company harm with no third option.
- **Anything that could take the portal down** — shared auth paths, middleware, session handling, DB writes touching all rows.
- **Deleting anything** that isn't provably dead.

---

## 4. Reporting format

Don't report after every step. Work through the batch and report once at the end, unless you hit §3.

When you do report:
- What you built, and any place you departed from the brief with the reason.
- What you verified vs. what you inferred, kept clearly separate.
- Anything you're less than confident about — be specific rather than reassuring.
- What's still open on each finding.
- The resume pointer.

If a session runs out of room, checkpoint to `AUDIT/01-findings.md` and end with the next file to read. Don't summarise progress mid-flight otherwise.