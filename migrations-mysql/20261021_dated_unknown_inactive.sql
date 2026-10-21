-- Run before deploying code that reads animals.inactive_since.
-- This is the first day the animal is not active. It does not imply a sale or death.
ALTER TABLE animals
  MODIFY COLUMN status ENUM('active', 'inactive', 'slaughtered', 'sold', 'expired') NOT NULL DEFAULT 'active',
  ADD COLUMN inactive_since DATE NULL AFTER status;
