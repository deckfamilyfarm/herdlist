-- Existing installations: apply once before deploying the seasonal rate code.
ALTER TABLE grazing_rates
  ADD COLUMN season_start_month TINYINT UNSIGNED NULL,
  ADD COLUMN season_end_month TINYINT UNSIGNED NULL,
  ADD COLUMN age_threshold_months SMALLINT UNSIGNED NULL,
  ADD COLUMN older_rate_cents INT NULL,
  ADD COLUMN younger_rate_cents INT NULL;

-- Creamy Cow's new rule starts October 20, 2026. Earlier charges keep their
-- previously saved effective-dated rate (currently $0.75/head/day).
INSERT INTO grazing_rates
  (contract_id, effective_date, rate_cents, season_start_month,
   season_end_month, age_threshold_months, older_rate_cents, younger_rate_cents)
SELECT id, '2026-10-20', 100, 12, 3, 12, 325, 150
FROM grazing_contracts WHERE id = 'creamy-cow-dairy';
