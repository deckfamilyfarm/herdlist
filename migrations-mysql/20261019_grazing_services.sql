-- Run once before deploying the Grazing Services application code.
CREATE TABLE owners (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE animals ADD COLUMN owner_id VARCHAR(36) NULL;

CREATE TABLE animal_ownership (
  id VARCHAR(36) PRIMARY KEY,
  animal_id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY animal_ownership_animal_date_idx (animal_id, effective_date),
  KEY animal_ownership_owner_idx (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grazing_contracts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  kind ENUM('dairy', 'general') NOT NULL,
  active_from DATE NOT NULL,
  active_to DATE NULL,
  dairy_barn_field_id VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY grazing_contracts_owner_idx (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grazing_assignments (
  id VARCHAR(36) PRIMARY KEY,
  contract_id VARCHAR(36) NOT NULL,
  animal_id VARCHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  KEY grazing_assignments_contract_animal_idx (contract_id, animal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grazing_rates (
  contract_id VARCHAR(36) NOT NULL,
  effective_date DATE NOT NULL,
  rate_cents INT NOT NULL,
  PRIMARY KEY (contract_id, effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO owners (id, name) VALUES
  ('deck-family-farm', 'Deck Family Farm'),
  ('creamy-cow-llc', 'Creamy Cow, LLC');

UPDATE animals SET owner_id = CASE
  WHEN LOWER(TRIM(type)) = 'dairy' THEN 'creamy-cow-llc'
  ELSE 'deck-family-farm'
END;

-- Animals without birth dates retain a current owner but require an explicit
-- effective date before historical owner-based charges can be calculated.
INSERT INTO animal_ownership (id, animal_id, owner_id, effective_date)
SELECT UUID(), id, owner_id, date_of_birth FROM animals WHERE date_of_birth IS NOT NULL;

INSERT INTO grazing_contracts
  (id, name, owner_id, kind, active_from, dairy_barn_field_id)
VALUES
  ('creamy-cow-dairy', 'Creamy Cow dairy grazing', 'creamy-cow-llc', 'dairy', '2000-01-01',
   (SELECT CASE WHEN COUNT(*) = 1 THEN MAX(id) ELSE NULL END
    FROM fields WHERE LOWER(TRIM(name)) = 'dairy barn'));
