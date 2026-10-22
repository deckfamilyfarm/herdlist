# Calf birth location audit — 2026-10-21

On 2026-10-21, 35 calves received a dated initial movement to the field recorded for their dam on the calf's birth date. The reviewed records are in `scripts/calf-birth-location-backfill-2026-10-21.json`; the repair script is idempotent. Four more calves (2601, 2602, Blossom, and Juju) were repaired with additional birth, barn, and pasture evidence; see [the April repair](april-2026-calf-location-repair.md).

These 22 calves still need a dated location correction. For 20, the first calf movement starts from a different field than the dam's recorded field on the birth date. Record the intervening calf movements, or correct the source records. Two have no calf movement; their current field is different from the dam's birth field or empty. Their location history needs review before backfilling. A birth movement alone would leave an undocumented interval and could alter grazing charges.

| Calf | Birth date | Dam's field at birth | First calf move starts from | First move date |
| --- | --- | --- | --- | --- |
| 2633 | 2026-05-02 | Back Hillside | Dairy Barn | 2026-06-11 |
| 2624 | 2026-04-24 | Back Hillside | Owens, South | 2026-05-05 |
| 2619 | 2026-04-20 | Back Hillside | Owens, South | 2026-05-05 |
| 2607 | 2026-04-11 | Owens, North | Back Hillside | 2026-04-25 |
| Lollipop | 2026-05-01 | Ryan's Airport Road Dairy | Dairy Barn | 2026-08-26 |
| 2608 | 2026-04-12 | Owens, North | Back Hillside | 2026-04-25 |
| Mariposa | 2026-06-01 | Back Hillside | No calf movement | — |
| 2638 | 2026-05-10 | Back Hillside | All Iris Fields | 2026-09-09 |
| 2603 | 2026-04-03 | Owens, South | Owens, Middle | 2026-04-07 |
| 2614 | 2026-04-15 | Back Hillside | Owens, South | 2026-05-05 |
| 2610 | 2026-04-14 | Back Hillside | Owens, South | 2026-05-05 |
| 2644 | 2026-05-20 | All Deck Family Farm Fields | Dairy Barn | 2026-06-11 |
| 2641 | 2026-05-11 | Back Hillside | Front Driveway, East | 2026-06-22 |
| 2612 | 2026-04-14 | Back Hillside | Owens, South | 2026-05-05 |
| 2615 | 2026-04-16 | Back Hillside | All Iris Fields | 2026-09-12 |
| 2634 | 2026-05-05 | All Iris Fields | Back Hillside | 2026-06-10 |
| 26XXSage | 2026-02-15 | Dairy Barn | No calf movement | — |
| 2611 | 2026-04-14 | Back Hillside | Owens, South | 2026-05-05 |
| 2609 | 2026-04-13 | Owens, North | Back Hillside | 2026-04-25 |
| 2605 | 2026-04-11 | Owens, North | Back Hillside | 2026-04-25 |
| 2606 | 2026-04-11 | Owens, North | Back Hillside | 2026-04-25 |
| 2618 | 2026-04-20 | Back Hillside | Owens, South | 2026-05-05 |

Archived animals can have no current field after their exit; this audit concerns their missing birth period.
