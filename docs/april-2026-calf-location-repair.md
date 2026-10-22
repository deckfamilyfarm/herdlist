# April 2026 calf location repair

The April 2026 grazing report showed **No dated location** for 2601, 2602, Blossom, and Juju. Their current Hayfield-Northwest field could not establish where they were in April. Birth notes, dam records, the first recorded calf movement, and owner confirmation on 2026-10-21 supplied the missing timeline.

| Calf | Dated location chain added | Evidence |
| --- | --- | --- |
| 2601 | Feb 21 birth → Dairy Barn; May 23 Dairy Barn → Swamp Field | Owner confirmed Dairy Barn through April. Dam Heather's May 23 move goes from Dairy Barn to Swamp Field; the calf's first recorded June 16 move starts at Swamp Field. |
| 2602 | Mar 13 birth → Dairy Barn | Owner confirmed Dairy Barn through April. The calf's first recorded May 23 move starts at Dairy Barn. |
| Blossom | Apr 4 birth → Maternity, North; Apr 4 → Dairy Barn | Dam Belen's Apr 4 note says Blossom was born in North Maternity and brought to the barn that afternoon; owner confirmed the move. The May 23 movement starts at Dairy Barn. |
| Juju | Apr 16 birth → Back Hillside; Apr 16 → Dairy Barn | Dam Josephina's Apr 16 note says Juju was born on Back Hillside and brought to the wet herd that afternoon; owner confirmed Dairy Barn. The May 23 movement starts at Dairy Barn. |

The two same-day timestamps for Blossom and Juju encode move order. The notes do not establish exact clock times.

## Reusable repair case

For any calf with **No dated location** before its first movement, review its birth record, dam's dated movements, notes, and the origin of the first calf movement. Add a dated birth location and any intervening moves only when the evidence establishes the location and effective date. The proposed chain must connect to the first existing movement's origin, and its latest destination must still match the current field.

Put reviewed steps in a manifest like [`scripts/april-2026-location-backfill.json`](../scripts/april-2026-location-backfill.json). Run `node --env-file=.env scripts/backfill-initial-location-chains.mjs MANIFEST.json` to check the complete chain, then rerun with `--apply`. The script verifies the animal, fields, movement continuity, and current field in one transaction; rerunning an applied plan adds nothing.

New animal entry now requires an initial field and effective date. A calf moved on its birth date needs its later same-day move recorded as well. Do not carry the dam's birth field forward across an undocumented move.

After this repair, the April 2026 grazing report has zero **No dated location** warnings. These four calves have no April grazing rows because their effective field for each April day is Dairy Barn.
