-- Validité figée + lien facture↔vente + normalisation commissions CT

SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'validite_mois');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `validite_mois` INT NOT NULL DEFAULT 24', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND COLUMN_NAME = 'date_expiration');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD COLUMN `date_expiration` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ventes' AND INDEX_NAME = 'ventes_date_expiration_idx');
SET @sql := IF(@exists = 0, 'ALTER TABLE `ventes` ADD INDEX `ventes_date_expiration_idx` (`date_expiration`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'factures' AND COLUMN_NAME = 'vente_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `factures` ADD COLUMN `vente_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'factures' AND INDEX_NAME = 'factures_vente_id_key');
SET @sql := IF(@exists = 0, 'ALTER TABLE `factures` ADD UNIQUE INDEX `factures_vente_id_key` (`vente_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE ventes
SET
  validite_mois = 24,
  date_expiration = DATE_ADD(date_vente, INTERVAL 24 MONTH)
WHERE date_expiration IS NULL;

-- Une seule commission AUTHENTIQUE par plaque (la plus ancienne). Les lignes déjà payées restent.
UPDATE verifications v
LEFT JOIN plaques p ON p.id = v.plaque_id
LEFT JOIN ventes ve ON ve.plaque_id = p.id
SET v.commission_taux = 0, v.commission_montant = 0
WHERE v.resultat = 'AUTHENTIQUE'
  AND v.paiement_commission_id IS NULL
  AND v.commission_montant > 0
  AND (v.plaque_id IS NULL OR p.statut <> 'VENDUE' OR ve.id IS NULL OR ve.prix_vente <= 0);

UPDATE verifications v
INNER JOIN (
  SELECT plaque_id, MIN(id) AS keep_id
  FROM verifications
  WHERE resultat = 'AUTHENTIQUE'
    AND plaque_id IS NOT NULL
    AND commission_montant > 0
  GROUP BY plaque_id
  HAVING COUNT(*) > 1
) d ON v.plaque_id = d.plaque_id
SET v.commission_taux = 0, v.commission_montant = 0
WHERE v.resultat = 'AUTHENTIQUE'
  AND v.paiement_commission_id IS NULL
  AND v.id <> d.keep_id;
