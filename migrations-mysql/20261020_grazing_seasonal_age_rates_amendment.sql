-- Apply after 20261020_grazing_seasonal_age_rates.sql.
ALTER TABLE grazing_rates ADD COLUMN free_under_months SMALLINT UNSIGNED NULL;

-- From this rule's effective date, calves below six calendar months are
-- listed as grazing at $0; the six-month anniversary begins the paid tier.
UPDATE grazing_rates SET free_under_months = 6
WHERE contract_id = 'creamy-cow-dairy' AND effective_date = '2026-10-20';
