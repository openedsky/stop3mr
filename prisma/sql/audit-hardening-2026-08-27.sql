-- Audit Stop 3MR — durcissement MariaDB (intégrité, index, nettoyage devis)

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Reliquat module devis retiré de l'application
ALTER TABLE factures DROP FOREIGN KEY IF EXISTS factures_devis_id_fkey;
DROP INDEX IF EXISTS factures_devis_id_key ON factures;
ALTER TABLE factures DROP COLUMN IF EXISTS devis_id;
DROP TABLE IF EXISTS devis;

SET FOREIGN_KEY_CHECKS = 1;

-- 2. Site de production : clé étrangère (codes historiques PR/YK/BK conservés, inactifs)
ALTER TABLE plaques
  MODIFY produit_id INT NOT NULL,
  MODIFY site_production VARCHAR(10) NOT NULL DEFAULT 'YP';

-- FK site : ignorer si déjà présente
SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'plaques'
    AND CONSTRAINT_NAME = 'plaques_site_production_fkey'
);
SET @sql := IF(@fk = 0,
  'ALTER TABLE plaques ADD CONSTRAINT plaques_site_production_fkey FOREIGN KEY (site_production) REFERENCES sites_production(code) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Index manquants (requêtes listes / filtres)
CREATE INDEX IF NOT EXISTS plaques_commercial_statut_idx ON plaques (commercial_id, statut);
CREATE INDEX IF NOT EXISTS clients_actif_type_fne_idx ON clients (actif, type_client, fne_statut);
CREATE INDEX IF NOT EXISTS ventes_vendeur_date_idx ON ventes (vendeur_id, date_vente);
CREATE INDEX IF NOT EXISTS factures_date_emission_idx ON factures (date_emission);
CREATE INDEX IF NOT EXISTS recus_date_paiement_idx ON recus_paiement (date_paiement);
CREATE INDEX IF NOT EXISTS rapports_type_statut_idx ON rapports (type, statut);
CREATE INDEX IF NOT EXISTS journal_audit_action_idx ON journal_audit (action);
CREATE INDEX IF NOT EXISTS journal_audit_user_time_idx ON journal_audit (utilisateur_id, horodatage);
CREATE INDEX IF NOT EXISTS centres_controle_actif_idx ON centres_controle (actif);
CREATE INDEX IF NOT EXISTS sites_production_actif_idx ON sites_production (actif);

-- 4. Contraintes de domaine (MariaDB 10.4 les applique)
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_montants_chk;
ALTER TABLE factures ADD CONSTRAINT factures_montants_chk
  CHECK (montant_ht >= 0 AND montant_ttc >= 0 AND montant_paye >= 0 AND montant_paye <= montant_ttc);

ALTER TABLE recus_paiement DROP CONSTRAINT IF EXISTS recus_montant_chk;
ALTER TABLE recus_paiement ADD CONSTRAINT recus_montant_chk CHECK (montant > 0);

ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_montants_chk;
ALTER TABLE ventes ADD CONSTRAINT ventes_montants_chk
  CHECK (prix_vente >= 0 AND commission_montant >= 0 AND commission_montant <= prix_vente);

ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_prix_chk;
ALTER TABLE produits ADD CONSTRAINT produits_prix_chk
  CHECK (prix_ht >= 0 AND commission_taux >= 0 AND commission_taux <= 100);

-- 5. Collation homogène
ALTER TABLE rapports CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. QR PNG inutiles en base (régénérés à la volée pour les PDF)
UPDATE plaques SET qr_code_data = '' WHERE qr_code_data LIKE 'data:%';
