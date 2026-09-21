# Dairy Choreboard animal API integration

Dairy Choreboard can read Herd List animals as JSON while using the same Timesheets identities. Store the Herd List animal `id` in Choreboard as the permanent relationship. Do not use `tagNumber` as the key because a tag can be corrected or replaced.

## Authentication

Choreboard should call Herd List from its backend and forward the current user's Timesheets access token:

```http
Authorization: Bearer <timesheets-access-token>
Accept: application/json
```

Herd List validates the token against Timesheets `POST /auth/getUserRole` on every request and applies `HERDLIST_TIMESHEETS_ALLOWED_ROLES`. A revoked token or disallowed role receives `401`.

Configure Herd List with:

```env
TIMESHEETS_API_URL=https://timesheets.deckfamilyfarm.com/api
# Leave empty to permit every valid Timesheets role, or provide a comma-separated list.
HERDLIST_TIMESHEETS_ALLOWED_ROLES=1,2
```

Do not put a shared Timesheets password or a permanent access token in frontend code. If Choreboard currently keeps its Timesheets token in a server-side session, make the Herd List request from that server session.

## Endpoints

### Find animals

```http
GET /api/animals?q=2319&status=active&limit=25
```

All parameters are optional and combined with AND:

| Parameter | Behavior |
| --- | --- |
| `q` | Case-insensitive partial search of tag number, phenotype, and current field name |
| `tagNumber` | Exact, case-insensitive tag lookup |
| `status` | Exact status filter, such as `active` |
| `type` | Exact animal type filter, such as `dairy` |
| `sex` | Exact sex filter |
| `fieldId` | Exact current field UUID |
| `herdName` | Exact herd-name filter |
| `limit` | Return at most 1–1000 records |

The response is a JSON array. An exact tag lookup looks like:

```bash
curl --get "https://HERDLIST_HOST/api/animals" \
  --data-urlencode "tagNumber=2319" \
  -H "Authorization: Bearer $TIMESHEETS_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

### Read and validate an animal ID

```http
GET /api/animals/:id
```

```bash
curl "https://HERDLIST_HOST/api/animals/76e16ee2-3fc5-4e68-a751-6f6c787d90dd" \
  -H "Authorization: Bearer $TIMESHEETS_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

The response contains the canonical UUID, tag, date of birth, status, current field ID/name, herd, lineage, and other registry attributes. Calculate current age from `dateOfBirth`; do not persist age as a value that becomes stale.

Relevant response codes are:

- `200`: animal found
- `400`: invalid search parameters
- `401`: missing, invalid, expired, or role-disallowed Timesheets token
- `404`: animal ID not found

### Read offspring

```http
GET /api/animals/:id/offspring
```

This also accepts Timesheets bearer authentication and returns a JSON array.

## Choreboard storage pattern

Keep Choreboard-owned data in Choreboard and link it to the Herd List UUID:

```sql
CREATE TABLE animal_chore_data (
  id UUID PRIMARY KEY,
  animal_id VARCHAR(36) NOT NULL,
  animal_tag_snapshot VARCHAR(255),
  chore_type VARCHAR(100) NOT NULL,
  notes TEXT,
  completed_at TIMESTAMP NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_animal_chore_data_animal_id
  ON animal_chore_data(animal_id);
```

Before saving new Choreboard data, call `GET /api/animals/:id`. Save when it returns `200`; reject an unknown animal on `404`. The optional tag snapshot is useful for audit displays, but `animal_id` remains authoritative.

## TypeScript server example

```ts
const herdListBaseUrl = process.env.HERDLIST_API_URL!;

export async function getAnimal(animalId: string, timesheetsToken: string) {
  const response = await fetch(
    `${herdListBaseUrl}/api/animals/${encodeURIComponent(animalId)}`,
    {
      headers: {
        Authorization: `Bearer ${timesheetsToken}`,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) return null;
  if (response.status === 401) throw new Error("Timesheets authentication failed");
  if (!response.ok) throw new Error(`Herd List request failed: ${response.status}`);
  return response.json();
}
```

Set Choreboard's server environment variable to the deployed Herd List origin:

```env
HERDLIST_API_URL=https://HERDLIST_HOST
```
