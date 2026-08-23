# Delhivery Integration

## Rules
- ALWAYS read docs/delhivery-reference.md before touching Delhivery code.
  Those payloads are verified against the live API. Do not invent fields.
- For anything not in that file, fetch https://delhivery-express-api-doc.readme.io/llms.txt
  and read the relevant reference page. Do not guess.
- DELHIVERY_TOKEN is server-side only. Never in client code, never in logs,
  never in a test fixture, never in a commit.
- POST /api/cmu/create.json is form-encoded: format=json&data=<urlencoded JSON>.
  Never retry it automatically — a retry creates a duplicate shipment.
- Sanitize & # % ; \ out of every string going into a Delhivery payload.
- Every Delhivery call is logged raw (request + response) to api_call_log.
- Every write operation is idempotent.
- Respect the tracking pull limit: 750 requests / 5 min / IP.

## Working style
- One phase at a time. Do not start the next phase unprompted.
- Ask me rather than assuming when something is ambiguous.