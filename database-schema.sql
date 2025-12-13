-- Herd Management System - MySQL Database Schema
-- This file contains the complete database schema for importing into MySQL

-- Animals Table
CREATE TABLE IF NOT EXISTS `animals` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tag_number` VARCHAR(255) NOT NULL UNIQUE,
  `type` VARCHAR(50) NOT NULL,
  `sex` VARCHAR(20) NOT NULL,
  `date_of_birth` DATE,
  `sire_id` VARCHAR(36),
  `dam_id` VARCHAR(36),
  `current_field_id` VARCHAR(36),
  `organic` BOOLEAN DEFAULT FALSE,
  `phenotype` VARCHAR(1000),
  `betacasein` ENUM('A2/A2','A1','Not Tested'),
  `polled` BOOLEAN DEFAULT FALSE,
  `herd_name` ENUM('wet', 'nurse', 'finish', 'main', 'grafting', 'yearling', 'missing', 'bull'),
  `status` ENUM('active', 'slaughtered', 'sold', 'died', 'missing') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Properties Table
CREATE TABLE IF NOT EXISTS `properties` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `is_leased` VARCHAR(10) NOT NULL,
  `lease_start_date` DATE,
  `lease_end_date` DATE,
  `leaseholder` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fields Table
CREATE TABLE IF NOT EXISTS `fields` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `property_id` VARCHAR(36) NOT NULL,
  `capacity` INT,
  `acres` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Movements Table
CREATE TABLE IF NOT EXISTS `movements` (
  `id` VARCHAR(36) PRIMARY KEY,
  `animal_id` VARCHAR(36) NOT NULL,
  `from_field_id` VARCHAR(36),
  `to_field_id` VARCHAR(36) NOT NULL,
  `movement_date` TIMESTAMP NOT NULL,
  `notes` VARCHAR(1000),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_field_id`) REFERENCES `fields`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`to_field_id`) REFERENCES `fields`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vaccinations Table
CREATE TABLE IF NOT EXISTS `vaccinations` (
  `id` VARCHAR(36) PRIMARY KEY,
  `animal_id` VARCHAR(36) NOT NULL,
  `vaccine_name` VARCHAR(255) NOT NULL,
  `administered_date` DATE NOT NULL,
  `administered_by` VARCHAR(255),
  `next_due_date` DATE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events Table
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `animal_id` VARCHAR(36) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `event_date` DATE NOT NULL,
  `description` VARCHAR(1000),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notes Table
CREATE TABLE IF NOT EXISTS `notes` (
  `id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  `animal_id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` VARCHAR(2000) NOT NULL,
  `note_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Breeding Records Table
CREATE TABLE IF NOT EXISTS `breeding_records` (
  `id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  `animal_id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` ENUM('observed_live_cover','extended_exposure','ai') NOT NULL,
  `breeding_date` DATE,
  `exposure_start_date` DATE,
  `exposure_end_date` DATE,
  `sire_id` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `notes` VARCHAR(2000),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sire_id`) REFERENCES `animals`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calving Records Table
CREATE TABLE IF NOT EXISTS `calving_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `dam_id` VARCHAR(36) NOT NULL,
  `calving_date` DATE NOT NULL,
  `calf_id` VARCHAR(36),
  `calf_tag_number` VARCHAR(255),
  `calf_sex` VARCHAR(20),
  `notes` VARCHAR(1000),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`dam_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`calf_id`) REFERENCES `animals`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Slaughter Records Table
CREATE TABLE IF NOT EXISTS `slaughter_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `animal_id` VARCHAR(36) NOT NULL,
  `slaughter_date` DATE NOT NULL,
  `age_months` INT,
  `live_weight` DECIMAL(10, 2),
  `hanging_weight` DECIMAL(10, 2),
  `processor` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions Table (for express-mysql-session)
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` VARCHAR(128) PRIMARY KEY,
  `expires` INT NOT NULL,
  `data` TEXT,
  INDEX `IDX_session_expire` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table (for authentication)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100),
  `last_name` VARCHAR(100),
  `is_admin` VARCHAR(10) NOT NULL DEFAULT 'no',
  `password_reset_token` VARCHAR(255),
  `password_reset_expires` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for better query performance
CREATE INDEX `idx_animals_tag` ON `animals`(`tag_number`);
CREATE INDEX `idx_animals_current_field` ON `animals`(`current_field_id`);
CREATE INDEX `idx_movements_animal` ON `movements`(`animal_id`);
CREATE INDEX `idx_movements_date` ON `movements`(`movement_date`);
CREATE INDEX `idx_vaccinations_animal` ON `vaccinations`(`animal_id`);
CREATE INDEX `idx_events_animal` ON `events`(`animal_id`);
