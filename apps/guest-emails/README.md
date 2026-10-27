# Guest emails and phone numbers

Reads the conference order export and writes comma-separated lists for people with a Registration or Online Only ticket.

```bash
npm install
npm run build && npm start
```

Optional: pass a CSV path as the first argument. Otherwise the app uses the newest file in `exports/2026/`, then `exports/`, then `fixtures/2026-sample.csv`.

Output:

- `out/guest-emails.txt`
- `out/guest-phones.txt`

Attendee email comes from “What is your e-mail?”, with the purchaser email as a fallback. Phone numbers come from “What is your phone number?”. Dinner, donation, and recording rows are skipped. Cancelled orders are skipped.
