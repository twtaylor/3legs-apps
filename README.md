# Conference export tools

Tools for turning a conference order export into a guest email list, a Saturday dinner roster, and printable name badges.

Real registration files stay on your machine. This repository includes only an invented sample, [fixtures/2026-sample.csv](fixtures/2026-sample.csv).

## Quick start

Put the order export at `exports/2026/` (any `.csv` in that folder). The tools use the newest file there. You can also pass a path as the first argument. If `exports/` is empty, the tools use the sample fixture.

```bash
cd apps/guest-list
npm install
npm run transform

cd ../guest-emails
npm install
npm run build && npm start

cd ../badge-generator
npm install
npm run generate
```

Generated files are written to `out/`, which is gitignored:

- `out/consolidated.csv` — one row per in-person registration, plus 18 Service Panel placeholders
- `out/dinner.csv` — purchaser, order id, and dinner quantity
- `out/guest-emails.txt` and `out/guest-phones.txt` — comma-separated lists for Registration and Online Only
- `out/badges.pdf` — Avery 5390 inserts

## Badges

Each badge shows the name from “What name would you like displayed on your badge?” If that answer is blank, the tools use the attendee’s first name and last initial. The homegroup is printed underneath. Dinner, recordings, and donations are not printed on the badge.

Print `out/badges.pdf` at 100% (actual size) on Avery 5390 insert sheets. The page is US Letter, with eight inserts in two columns and four rows. Each insert is 3.5 inches wide by 2.25 inches tall. Do not scale to fit.

## What the export looks like

The expected file is a comma-separated order export. Ticket rows use `Type` of `TICKET` and `Description` of `Registration` or `Online Only`. Saturday dinner is a `PRODUCT` row whose description contains “dinner”. Cancelled orders (`Order cancelled` other than `0`) are skipped.

An order can contain more than one attendee. Each Registration row becomes its own badge, using that row’s attendee answers.

## Layout

```
apps/
  guest-list/        # registration list and dinner roster
  guest-emails/      # email and phone extraction
  badge-generator/   # Avery 5390 PDF
fixtures/
  2026-sample.csv    # invented rows in the export shape
exports/             # your real export (not committed)
out/                 # generated files (not committed)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the sheet measurements and field mapping.
