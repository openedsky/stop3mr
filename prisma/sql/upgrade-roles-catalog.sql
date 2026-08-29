-- Stop 3MR : rôles commerciaux / CT, catalogue, affectations, commissions, vérifications

CREATE TABLE IF NOT EXISTS `centres_controle` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `libelle` VARCHAR(200) NOT NULL,
  `ville` VARCHAR(100) NULL,
  `pays` VARCHAR(100) NOT NULL DEFAULT 'Côte d''Ivoire',
  `adresse` VARCHAR(255) NULL,
  `actif` TINYINT(1) NOT NULL DEFAULT 1,
  `cree_le` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `centres_controle_code_key` (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `produits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `famille` ENUM('LIMITATION', 'PLAQUE_ROUGE', 'PLAQUE_BLANCHE', 'BANDES_ROUGE_JAUNE', 'BANDES_ROUGE_BLANC') NOT NULL,
  `dimensions` VARCHAR(80) NOT NULL,
  `visibilite` VARCHAR(80) NOT NULL,
  `prix_ht` INT NOT NULL,
  `commission_taux` INT NOT NULL DEFAULT 10,
  `usage_principal` VARCHAR(255) NOT NULL,
  `vitesses_disponibles` VARCHAR(80) NULL,
  `barre` TINYINT(1) NOT NULL DEFAULT 0,
  `image_path` VARCHAR(255) NULL,
  `actif` TINYINT(1) NOT NULL DEFAULT 1,
  `ordre` INT NOT NULL DEFAULT 0,
  `cree_le` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `mis_a_jour_le` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `produits_code_key` (`code`),
  KEY `produits_famille_actif_idx` (`famille`, `actif`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'utilisateurs' AND COLUMN_NAME = 'telephone');
SET @sql := IF(@exists = 0, 'ALTER TABLE `utilisateurs` ADD COLUMN `telephone` VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'utilisateurs' AND COLUMN_NAME = 'centre_controle_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `utilisateurs` ADD COLUMN `centre_controle_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `utilisateurs`
  MODIFY COLUMN `role` ENUM('OPERATEUR', 'ADMINISTRATEUR', 'COMMERCIAL', 'AGENT_CT') NOT NULL DEFAULT 'OPERATEUR';

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'utilisateurs' AND INDEX_NAME = 'utilisateurs_role_actif_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `utilisateurs` ADD INDEX `utilisateurs_role_actif_idx` (`role`, `actif`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'utilisateurs' AND INDEX_NAME = 'utilisateurs_centre_controle_id_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `utilisateurs` ADD INDEX `utilisateurs_centre_controle_id_idx` (`centre_controle_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'utilisateurs' AND CONSTRAINT_NAME = 'utilisateurs_centre_controle_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_centre_controle_id_fkey` FOREIGN KEY (`centre_controle_id`) REFERENCES `centres_controle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND COLUMN_NAME = 'produit_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `plaques` ADD COLUMN `produit_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND COLUMN_NAME = 'vitesse_limitation');
SET @sql := IF(@exists = 0, 'ALTER TABLE `plaques` ADD COLUMN `vitesse_limitation` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND COLUMN_NAME = 'commercial_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `plaques` ADD COLUMN `commercial_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND COLUMN_NAME = 'affectee_le');
SET @sql := IF(@exists = 0, 'ALTER TABLE `plaques` ADD COLUMN `affectee_le` DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `plaques`
  MODIFY COLUMN `statut` ENUM('EN_STOCK', 'AFFECTEE', 'VENDUE') NOT NULL DEFAULT 'EN_STOCK';

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND INDEX_NAME = 'plaques_produit_id_statut_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `plaques` ADD INDEX `plaques_produit_id_statut_idx` (`produit_id`, `statut`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND CONSTRAINT_NAME = 'plaques_produit_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `plaques` ADD CONSTRAINT `plaques_produit_id_fkey` FOREIGN KEY (`produit_id`) REFERENCES `produits`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plaques' AND CONSTRAINT_NAME = 'plaques_commercial_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `plaques` ADD CONSTRAINT `plaques_commercial_id_fkey` FOREIGN KEY (`commercial_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'centre_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `centre_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'prix_vente');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `prix_vente` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'commission_taux');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `commission_taux` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'commission_montant');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `commission_montant` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND INDEX_NAME = 'ventes_centre_id_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD INDEX `ventes_centre_id_idx` (`centre_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND CONSTRAINT_NAME = 'ventes_centre_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `ventes` ADD CONSTRAINT `ventes_centre_id_fkey` FOREIGN KEY (`centre_id`) REFERENCES `centres_controle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `affectations_stock` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `plaque_id` INT NOT NULL,
  `commercial_id` INT NOT NULL,
  `operateur_id` INT NULL,
  `date_affectation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `affectations_stock_commercial_id_idx` (`commercial_id`),
  KEY `affectations_stock_plaque_id_idx` (`plaque_id`),
  CONSTRAINT `affectations_stock_plaque_id_fkey` FOREIGN KEY (`plaque_id`) REFERENCES `plaques`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `affectations_stock_commercial_id_fkey` FOREIGN KEY (`commercial_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `affectations_stock_operateur_id_fkey` FOREIGN KEY (`operateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `verifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `numero_saisi` VARCHAR(50) NOT NULL,
  `plaque_id` INT NULL,
  `agent_id` INT NOT NULL,
  `centre_id` INT NULL,
  `resultat` ENUM('AUTHENTIQUE', 'INCONNUE', 'CONTREFAITE') NOT NULL,
  `notes` TEXT NULL,
  `immatriculation_observee` VARCHAR(50) NULL,
  `horodatage` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `verifications_plaque_id_idx` (`plaque_id`),
  KEY `verifications_agent_id_idx` (`agent_id`),
  KEY `verifications_centre_id_idx` (`centre_id`),
  KEY `verifications_horodatage_idx` (`horodatage`),
  KEY `verifications_numero_saisi_idx` (`numero_saisi`),
  CONSTRAINT `verifications_plaque_id_fkey` FOREIGN KEY (`plaque_id`) REFERENCES `plaques`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `verifications_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `verifications_centre_id_fkey` FOREIGN KEY (`centre_id`) REFERENCES `centres_controle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
