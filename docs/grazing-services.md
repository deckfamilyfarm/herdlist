# Grazing Services

The `/grazing-services` page calculates monthly charges for Deck Family Farm
Grazing. Its default month is the last completed Pacific calendar month. The
current month runs through today. Reports are live calculations; historical
movement, ownership, contract, assignment, exit, or rate corrections change a
past month's result. No invoice or locked statement is created.

## Setup and migration

Run `migrations-mysql/20261019_grazing_services.sql` once on an existing MySQL
database before deploying application code. Back up the database first. The
migration creates Deck Family Farm and Creamy Cow, LLC owners and assigns
existing animals by current type: dairy to Creamy Cow, all other types to Deck
Family Farm. Dated ownership begins on each animal's recorded birth date.
Run `migrations-mysql/20261021_backfill_ownership_from_birth.sql` to repair
animals with a known birth date and current owner that still lack dated history.
It is safe to rerun. An animal without a birth date retains its current owner
but receives no inferred ownership start date. The Animal Issues report shows
the missing birth date first; after it is entered, the report asks for a dated
ownership record if one is still missing. Use **Record owner at date** in the
animal editor to confirm that history.

The migration seeds a Creamy Cow dairy contract with no rate. If exactly one
field is named Dairy Barn, it selects that field; otherwise choose the field in
the contract editor. In **Contracts and rules**, set an opening $/head/day rate
effective January 1, 2015. Add another rate with its own effective date when
the price changes; it applies from that day until the next change. An unset
rate leaves its head-days unpriced; an explicit zero rate is allowed. Databases
that already used monthly rates need the follow-up migration
`20261019_grazing_rate_effective_dates.sql`. It moves each contract's earliest
saved amount to January 1, 2015 and keeps later saved amounts on their former
month start dates.

Apply `migrations-mysql/20261020_grazing_seasonal_age_rates.sql` once on an
existing database before deploying seasonal pricing. A dated rate now has a
base $/head/day amount and may also have a month range, an age threshold in
calendar months, and two seasonal amounts. In the contract editor, choose
**Seasonal age rates** to configure these fields; **New rate from latest**
copies the current rule to a new effective date. Editing or removing an old
rule can change historical reports, so add a new dated rule for price changes.
The Creamy Cow rule effective October 20, 2026 uses a $1.00 base rate. During
December through March it uses $3.25 for animals over 12 months and $1.50 for
animals from six through 12 months. Animals under six months are listed at $0
in every month. Apply
`migrations-mysql/20261020_grazing_seasonal_age_rates_amendment.sql` after
the seasonal rate migration to add this free cutoff to the saved rule. The
previous $0.75 rate continues through October 19, 2026.

New animals default to Creamy Cow ownership when their type is dairy and Deck
Family Farm otherwise. The animal editor can choose a different owner. Owner
changes require an effective date; **Record owner at date** can add or correct
past ownership even when the current owner is unchanged. General contracts use
dated animal assignments with optional end dates. Each contract has its own
customer owner and active dates.

## Counting rules

One animal on one eligible calendar day is one head-day. Before the rule
effective October 20, 2026, dairy eligibility required age strictly greater
than six calendar months. From that rule onward, younger dairy animals outside
Dairy Barn are included as $0 head-days below six months. The six-month
anniversary begins the paid tier; calendar anniversaries are clamped for
shorter months. An animal without a usable birth date is assumed to be older
than one year for dairy age pricing; other ownership and location requirements
still apply. Movement destinations take effect on
their recorded calendar date. Days in the selected Dairy Barn field, a field
named Dairy Barn, or a field named Missing are excluded. An animal whose
current field is Missing is excluded from every month in the live report,
including general contracts, even if older movements show a different field.
A missing movement can use the animal's current field, with a warning that no
dated location exists for those report days. The warning does not mean the
animal has no current field.
Conflicting movements remain warnings; their days count when every recorded destination that day is
known to be outside Dairy Barn. When the last movement disagrees with the
current field, the mismatch remains a warning. A known Dairy Barn current
field excludes the day. Days with no known location remain uncharged.
Wet tags and Wet herd membership do not affect billing. Other recorded
locations, including Main Barn, count.

General contracts count assigned active days from the assignment start through
its end date, inclusive, except for animals currently assigned to Missing.
Missing or mismatched dated ownership appears as a warning and does not block
a charge. A dated sale, slaughter, or death event makes that date the last
eligible day. An inactive
animal without a dated exit is excluded entirely from the monthly report.

If multiple contracts qualify for the same animal-day, it is charged once.
Dairy contracts take priority, then the earliest contract start date, then
contract ID. The Warnings list names overlapping contracts. Charges use integer cents:
each head-day uses the rate in effect on its date, including a mid-month change.
Seasonal months include both endpoints and may span New Year. Age is checked
each billable day; the older tier starts the day after the age anniversary.
Animals without a usable birth date use the older seasonal tier.
The optional free cutoff applies all year and takes priority over base and
seasonal rates. It includes free animals in the animal and head-day counts.
The displayed priced total can be partial when any head-days lack a rate. The
page defaults to the Creamy Cow dairy contract and lets administrators select
another contract. Contracts and rules, and owners and animal assignments,
open from buttons at the top of the page.

## Interfaces and verification

All `/api/grazing-services/*` routes require a Herdlist administrator session.
The routes manage owners, dated ownership, contracts, assignments, dated
rates, and `GET /api/grazing-services/report?month=YYYY-MM`. The report includes
per-contract animal rows and review items. The existing report under Reports
remains a separate, non-billing analysis with different counting options.

Run `node --import tsx --test tests/grazing-services.test.mjs` for the core
financial calculation, `npm run build` for the client and server bundles, and
`npm run check` for the repository type check. The type check currently reports
pre-existing errors in unrelated files; new Grazing Services files should not
add any.

## Monthly PDF and email

Run `npm run report:grazing` from the Herdlist directory to report the last
completed Pacific calendar month. The standalone script reads the database,
uses the same calculation as the Grazing Services page, writes a PDF to
`reports/grazing-services/YYYY-MM-creamy-cow-dairy.pdf`, and emails it to
`jdeck88@gmail.com`. It does not post journal entries to an accounting system.
It refuses to email when any Creamy Cow head-days lack a contract rate, when
the selected month is incomplete, or when the contract's owner or type no
longer matches Creamy Cow dairy grazing.

The first PDF page shows the month, animal count, head-days, total charge, the
rate schedule, and two separate balanced general journal entries:

| Entity | Debit | Credit |
| --- | --- | --- |
| Deck Family Farm | Owner's Equity - transfer to Creamy Cow | Grazing Services Income |
| Creamy Cow, LLC | Grazing Services Expense | Owner's Equity - transfer from Deck Family Farm |

Both entries use the same monthly charge. Later pages list each animal number,
phenotype, type, sex, birth date, billable head-days, and charge. Any warnings
appear on a final review page. The report is support for the two entities'
manual entries; confirm the owner-equity account names and treatment with the
bookkeeper before posting.

For Gmail delivery, provide `MAIL_USER` and `MAIL_ACCESS` (a Gmail app password)
in Herdlist's `.env`. Alternatively, pass `--mail-env ../timesheets/server/.env`
to load the mail settings already used by the neighboring Timesheets project.
The script also accepts `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and
`SMTP_SECURE` for a general SMTP server. The email recipient defaults to
`jdeck88@gmail.com`; use `--to` to change it.

Preview without email:

```sh
npm run report:grazing -- --month 2026-09 --no-email
```

Send a specific completed month using the existing Timesheets mail settings:

```sh
npm run report:grazing -- --month 2026-09 --mail-env ../timesheets/server/.env
```

The script writes a `.sent.json` marker beside the PDF after successful mail
delivery. A repeat run for the same month and recipient skips sending. Use
`--resend` to deliver a corrected report after source records or rates change.
`--out /absolute/path/report.pdf` changes the PDF destination.

Use `-n N` or `--months N` to include up to 36 consecutive completed months,
ending with `--month` or with the last completed month by default. The script
writes a combined PDF whose first page has a table of every month, followed by
that month's GJEs and animal detail. It also writes and attaches one separate
PDF for each month. One email carries the combined PDF and the individual
monthly files. For example, January through September 2026:

```sh
npm run report:grazing -- --month 2026-09 -n 9 --mail-env ../timesheets/server/.env
```

With `-n`, `--out` names the combined PDF and its directory receives the
individual monthly PDFs. The usual cron command omits `-n` and still sends
one month at a time.

Example crontab entry, scheduled for 8 a.m. on the first day of each month
(replace the Node path with the result of `command -v node` on the cron host):

```cron
0 8 1 * * cd /Users/jdeck/code/herdlist && /opt/homebrew/bin/node --import tsx scripts/emailGrazingReport.mjs --mail-env ../timesheets/server/.env >> /Users/jdeck/code/herdlist/.local/grazing-report.log 2>&1
```

Run `node --test tests/grazing-report-pdf.test.mjs` to verify the entry layout,
effective-date split, month range, and PDF generation without connecting to the database
or sending email.
