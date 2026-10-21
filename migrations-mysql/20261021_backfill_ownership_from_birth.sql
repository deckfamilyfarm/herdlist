-- Safe to rerun. Use the assigned current owner only when no dated ownership
-- history exists and the animal has a recorded birth date.
INSERT INTO animal_ownership (id, animal_id, owner_id, effective_date)
SELECT UUID(), a.id, a.owner_id, a.date_of_birth
FROM animals a
JOIN owners o ON o.id = a.owner_id
WHERE a.date_of_birth IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM animal_ownership h WHERE h.animal_id = a.id
  );
