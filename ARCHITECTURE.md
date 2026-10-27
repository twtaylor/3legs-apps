# Architecture

## Data flow

```
Order export CSV
      |
      +-- guest-list ----> out/consolidated.csv ----> badge-generator ----> out/badges.pdf
      |                 \-> out/dinner.csv
      |
      +-- guest-emails --> out/guest-emails.txt
                        \-> out/guest-phones.txt
```

`guest-list` and `guest-emails` read the same export. They do not depend on each other. The badge generator reads only `out/consolidated.csv`.

## Export columns

The tools read a comma-separated order export, including a header byte-order mark when one is present. Rows whose `Order cancelled` value is present and not `0`, `false`, or `no` are ignored.

| Column | Use |
| --- | --- |
| Type | `TICKET`, `PRODUCT`, or `DONATION` |
| Description | `Registration`, `Online Only`, or a product name such as Saturday Evening Dinner |
| Order ID | Groups dinner add-ons for one purchaser |
| Name, First Name, Last Name, Email | Purchaser |
| Attendee name | Person the ticket is for |
| What is your e-mail? | Attendee email, with purchaser email as fallback |
| What is your phone number? | Attendee phone |
| What is your home group's name? | Line under the name on the badge |
| What name would you like displayed on your badge? | Badge name |

## Guest list

Location: `apps/guest-list/`.

Registration tickets become one consolidated row each. Two attendees on one order produce two rows. Online Only tickets are counted in the console summary and left out of the badge file. Dinner product rows are summed by order into `out/dinner.csv` with purchaser name, order id, and quantity. They are not copied onto badge rows.

If the badge-name answer is blank, the fallback is the attendee’s first name plus last initial (`Jordan Example` becomes `Jordan E.`). If the attendee name is also blank, the purchaser’s first name and last initial are used.

Registration rows are sorted by badge name. Eighteen Service Panel rows, with that label and an empty homegroup, are appended so spare inserts can be written by hand.

## Guest emails

Location: `apps/guest-emails/`.

Collects unique emails and phone numbers from Registration and Online Only tickets. Emails are lowercased. Phone numbers drop spaces, parentheses, and dashes. Output is a single comma-separated line in each text file.

## Badge generator

Location: `apps/badge-generator/`.

Every consolidated row with a badge name becomes one insert, including the Service Panel placeholders. Nothing else is drawn: no ticket type, no dinner mark, no icons, no border.

### Avery 5390

The stock is perforated insert cardstock, not adhesive labels. The PDF is US Letter, portrait, and must be printed at actual size.

| Measurement | Value |
| --- | --- |
| Page | 8.5 in × 11 in |
| Insert | 3.5 in wide × 2.219 in tall |
| Grid | 2 columns × 4 rows, no gaps |
| Left margin | 0.75 in |
| Top margin | 1.062 in |

The name is Helvetica Bold, 20 pt, reduced toward 12 pt if the line is wider than the insert. The homegroup is Helvetica 11 pt, centered, wrapped, and clipped after about four lines. The two lines are centered together inside the insert.

## Finding the export

Each reader checks, in order:

1. A path passed as the first argument
2. The newest `.csv` under `exports/2026/`
3. The newest `.csv` under `exports/`
4. `fixtures/2026-sample.csv`
