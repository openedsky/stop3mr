SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centres_controle' AND COLUMN_NAME = 'commune');
SET @sql := IF(@exists = 0, 'ALTER TABLE `centres_controle` ADD COLUMN `commune` VARCHAR(100) NULL AFTER `ville`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centres_controle' AND COLUMN_NAME = 'quartier');
SET @sql := IF(@exists = 0, 'ALTER TABLE `centres_controle` ADD COLUMN `quartier` VARCHAR(100) NULL AFTER `commune`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centres_controle' AND COLUMN_NAME = 'latitude');
SET @sql := IF(@exists = 0, 'ALTER TABLE `centres_controle` ADD COLUMN `latitude` DOUBLE NULL AFTER `adresse`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centres_controle' AND COLUMN_NAME = 'longitude');
SET @sql := IF(@exists = 0, 'ALTER TABLE `centres_controle` ADD COLUMN `longitude` DOUBLE NULL AFTER `latitude`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centres_controle' AND INDEX_NAME = 'centres_controle_pays_ville_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `centres_controle` ADD INDEX `centres_controle_pays_ville_idx` (`pays`, `ville`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
