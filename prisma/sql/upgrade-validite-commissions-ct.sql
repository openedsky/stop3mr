-- Validité 24 mois + commissions contrôleurs + paiements de commissions

SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produits' AND COLUMN_NAME = 'commission_taux_controleur');
SET @sql := IF(@exists = 0, 'ALTER TABLE `produits` ADD COLUMN `commission_taux_controleur` INT NOT NULL DEFAULT 10', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'paiement_commission_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `paiement_commission_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'verifications' AND COLUMN_NAME = 'commission_taux');
SET @sql := IF(@exists = 0, 'ALTER TABLE `verifications` ADD COLUMN `commission_taux` INT NOT NULL DEFAULT 0, ADD COLUMN `commission_montant` INT NOT NULL DEFAULT 0, ADD COLUMN `paiement_commission_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `paiements_commissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `numero` VARCHAR(30) NOT NULL,
  `type` ENUM('VENTE', 'CONTROLE') NOT NULL,
  `utilisateur_id` INT NOT NULL,
  `periode_debut` DATETIME(3) NOT NULL,
  `periode_fin` DATETIME(3) NOT NULL,
  `montant` INT NOT NULL,
  `nombre_operations` INT NOT NULL,
  `mode_paiement` ENUM('ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'AUTRE') NOT NULL,
  `reference` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `date_paiement` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createur_id` INT NULL,
  `cree_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paiements_commissions_numero_key` (`numero`),
  KEY `paiements_commissions_utilisateur_id_type_idx` (`utilisateur_id`, `type`),
  KEY `paiements_commissions_date_paiement_idx` (`date_paiement`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `parametres` (`cle`, `valeur`) VALUES
  ('plaque_validite_mois', '24'),
  ('plaque_alerte_expiration_jours', '30'),
  ('commission_taux_controleur_defaut', '10');

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'canal');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `canal` ENUM(''COMMERCIAL'', ''DIRECTE'') NOT NULL DEFAULT ''COMMERCIAL''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
