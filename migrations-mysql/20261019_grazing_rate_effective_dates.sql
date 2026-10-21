-- Run once only where grazing_rates still has the old month column.
-- Back up the database first.
-- Convert saved monthly rates to dated rates. Each contract's earliest saved
-- amount becomes its opening rate on 2015-01-01; later saved months retain
-- their first-of-month effective dates.

ALTER TABLE grazing_rates ADD COLUMN effective_date DATE NULL;

UPDATE grazing_rates
SET effective_date = STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d');

ALTER TABLE grazing_rates
  DROP PRIMARY KEY,
  DROP INDEX grazing_rates_contract_month_idx,
  DROP COLUMN month,
  MODIFY effective_date DATE NOT NULL,
  ADD PRIMARY KEY (contract_id, effective_date);

CREATE TEMPORARY TABLE grazing_first_rates (
  contract_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  effective_date DATE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO grazing_first_rates (contract_id, effective_date)
SELECT contract_id, MIN(effective_date) FROM grazing_rates GROUP BY contract_id;

UPDATE grazing_rates AS rate
JOIN grazing_first_rates AS first_rate
  ON rate.contract_id = first_rate.contract_id
  AND rate.effective_date = first_rate.effective_date
SET rate.effective_date = '2015-01-01'
WHERE first_rate.effective_date > '2015-01-01';

DROP TEMPORARY TABLE grazing_first_rates;
