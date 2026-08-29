ALTER TABLE sites_production
  ADD COLUMN pays VARCHAR(100) NOT NULL DEFAULT 'Côte d''Ivoire' AFTER libelle,
  ADD COLUMN commune VARCHAR(100) NULL AFTER ville,
  ADD COLUMN quartier VARCHAR(100) NULL AFTER commune,
  ADD COLUMN adresse VARCHAR(255) NULL AFTER quartier,
  ADD COLUMN latitude DOUBLE NULL AFTER adresse,
  ADD COLUMN longitude DOUBLE NULL AFTER latitude;
