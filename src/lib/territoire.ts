/** Localités ivoiriennes pour répartir ~1000 centres de contrôle technique. */

export type LocaliteCI = {
  ville: string;
  commune: string;
  region: string;
  lat: number;
  lng: number;
  slots: number;
};

export const LOCALITES_CI: LocaliteCI[] = [
  { ville: "Abidjan", commune: "Yopougon", region: "Abidjan", lat: 5.33694, lng: -4.08531, slots: 58 },
  { ville: "Abidjan", commune: "Abobo", region: "Abidjan", lat: 5.4162, lng: -4.0201, slots: 58 },
  { ville: "Abidjan", commune: "Cocody", region: "Abidjan", lat: 5.35995, lng: -3.98855, slots: 32 },
  { ville: "Abidjan", commune: "Adjamé", region: "Abidjan", lat: 5.3531, lng: -4.0239, slots: 16 },
  { ville: "Abidjan", commune: "Plateau", region: "Abidjan", lat: 5.32385, lng: -4.01972, slots: 8 },
  { ville: "Abidjan", commune: "Treichville", region: "Abidjan", lat: 5.3056, lng: -4.0067, slots: 12 },
  { ville: "Abidjan", commune: "Marcory", region: "Abidjan", lat: 5.3019, lng: -3.9828, slots: 14 },
  { ville: "Abidjan", commune: "Koumassi", region: "Abidjan", lat: 5.2972, lng: -3.9556, slots: 16 },
  { ville: "Abidjan", commune: "Port-Bouët", region: "Abidjan", lat: 5.2564, lng: -3.9261, slots: 14 },
  { ville: "Abidjan", commune: "Attécoubé", region: "Abidjan", lat: 5.3333, lng: -4.0417, slots: 12 },
  { ville: "Abidjan", commune: "Anyama", region: "Abidjan", lat: 5.4947, lng: -4.0517, slots: 18 },
  { ville: "Abidjan", commune: "Bingerville", region: "Abidjan", lat: 5.3558, lng: -3.8853, slots: 12 },
  { ville: "Abidjan", commune: "Songon", region: "Abidjan", lat: 5.3194, lng: -4.2536, slots: 10 },
  { ville: "Bouaké", commune: "Bouaké", region: "Gbêkê", lat: 7.68956, lng: -5.03028, slots: 42 },
  { ville: "Daloa", commune: "Daloa", region: "Haut-Sassandra", lat: 6.8774, lng: -6.4502, slots: 28 },
  { ville: "Korhogo", commune: "Korhogo", region: "Poro", lat: 9.458, lng: -5.6296, slots: 28 },
  { ville: "San-Pédro", commune: "San-Pédro", region: "San-Pédro", lat: 4.7485, lng: -6.6363, slots: 26 },
  { ville: "Yamoussoukro", commune: "Yamoussoukro", region: "Yamoussoukro", lat: 6.8276, lng: -5.2893, slots: 26 },
  { ville: "Man", commune: "Man", region: "Tonkpi", lat: 7.4125, lng: -7.5538, slots: 22 },
  { ville: "Gagnoa", commune: "Gagnoa", region: "Gôh", lat: 6.1319, lng: -5.9506, slots: 22 },
  { ville: "Divo", commune: "Divo", region: "Lôh-Djiboua", lat: 5.8374, lng: -5.3572, slots: 18 },
  { ville: "Abengourou", commune: "Abengourou", region: "Indénié-Djuablin", lat: 6.7297, lng: -3.4964, slots: 18 },
  { ville: "Soubré", commune: "Soubré", region: "Nawa", lat: 5.7856, lng: -6.5939, slots: 16 },
  { ville: "Agboville", commune: "Agboville", region: "Agnéby-Tiassa", lat: 5.928, lng: -4.2132, slots: 14 },
  { ville: "Bondoukou", commune: "Bondoukou", region: "Gontougo", lat: 8.0402, lng: -2.8, slots: 14 },
  { ville: "Bouaflé", commune: "Bouaflé", region: "Marahoué", lat: 6.9904, lng: -5.7442, slots: 12 },
  { ville: "Grand-Bassam", commune: "Grand-Bassam", region: "Sud-Comoé", lat: 5.2118, lng: -3.7388, slots: 12 },
  { ville: "Dabou", commune: "Dabou", region: "Grands-Ponts", lat: 5.3256, lng: -4.3767, slots: 12 },
  { ville: "Ferkessédougou", commune: "Ferkessédougou", region: "Tchologo", lat: 9.5928, lng: -5.1944, slots: 12 },
  { ville: "Odienné", commune: "Odienné", region: "Kabadougou", lat: 9.5051, lng: -7.5643, slots: 12 },
  { ville: "Aboisso", commune: "Aboisso", region: "Sud-Comoé", lat: 5.4678, lng: -3.2071, slots: 12 },
  { ville: "Duékoué", commune: "Duékoué", region: "Guémon", lat: 6.742, lng: -7.3492, slots: 10 },
  { ville: "Guiglo", commune: "Guiglo", region: "Cavally", lat: 6.5436, lng: -7.4936, slots: 10 },
  { ville: "Danané", commune: "Danané", region: "Tonkpi", lat: 7.2596, lng: -8.155, slots: 10 },
  { ville: "Vavoua", commune: "Vavoua", region: "Haut-Sassandra", lat: 7.3819, lng: -6.4778, slots: 10 },
  { ville: "Sinfra", commune: "Sinfra", region: "Marahoué", lat: 6.621, lng: -5.9114, slots: 10 },
  { ville: "Katiola", commune: "Katiola", region: "Hambol", lat: 8.1373, lng: -5.101, slots: 10 },
  { ville: "Séguéla", commune: "Séguéla", region: "Worodougou", lat: 7.9611, lng: -6.6731, slots: 10 },
  { ville: "Issia", commune: "Issia", region: "Haut-Sassandra", lat: 6.4924, lng: -6.5856, slots: 8 },
  { ville: "Toumodi", commune: "Toumodi", region: "Bélier", lat: 6.557, lng: -5.0177, slots: 8 },
  { ville: "Béoumi", commune: "Béoumi", region: "Gbêkê", lat: 7.6736, lng: -5.5808, slots: 8 },
  { ville: "Zuénoula", commune: "Zuénoula", region: "Marahoué", lat: 7.4278, lng: -6.0431, slots: 8 },
  { ville: "Oumé", commune: "Oumé", region: "Gôh", lat: 6.3831, lng: -5.4175, slots: 8 },
  { ville: "Lakota", commune: "Lakota", region: "Lôh-Djiboua", lat: 5.8475, lng: -5.6822, slots: 8 },
  { ville: "Agnibilékrou", commune: "Agnibilékrou", region: "Indénié-Djuablin", lat: 7.1311, lng: -3.2042, slots: 8 },
  { ville: "Bongouanou", commune: "Bongouanou", region: "Moronou", lat: 6.6517, lng: -4.2042, slots: 8 },
  { ville: "Daoukro", commune: "Daoukro", region: "Iffou", lat: 7.0586, lng: -3.9631, slots: 8 },
  { ville: "Dimbokro", commune: "Dimbokro", region: "N'Zi", lat: 6.6467, lng: -4.7053, slots: 8 },
  { ville: "Bonoua", commune: "Bonoua", region: "Sud-Comoé", lat: 5.2725, lng: -3.5961, slots: 8 },
  { ville: "Tabou", commune: "Tabou", region: "San-Pédro", lat: 4.423, lng: -7.3528, slots: 8 },
  { ville: "Sassandra", commune: "Sassandra", region: "Gbôklé", lat: 4.95, lng: -6.0833, slots: 8 },
  { ville: "Boundiali", commune: "Boundiali", region: "Bagoué", lat: 9.5219, lng: -6.4869, slots: 8 },
  { ville: "Bouna", commune: "Bouna", region: "Bounkani", lat: 9.2694, lng: -2.995, slots: 8 },
  { ville: "Tiassalé", commune: "Tiassalé", region: "Agnéby-Tiassa", lat: 5.8983, lng: -4.8283, slots: 8 },
  { ville: "Adiaké", commune: "Adiaké", region: "Sud-Comoé", lat: 5.2864, lng: -3.3042, slots: 6 },
  { ville: "Grand-Lahou", commune: "Grand-Lahou", region: "Grands-Ponts", lat: 5.2508, lng: -5.0033, slots: 6 },
  { ville: "Jacqueville", commune: "Jacqueville", region: "Grands-Ponts", lat: 5.205, lng: -4.4147, slots: 6 },
  { ville: "Alépé", commune: "Alépé", region: "La Mé", lat: 5.5006, lng: -3.6631, slots: 6 },
  { ville: "Akoupé", commune: "Akoupé", region: "La Mé", lat: 6.3842, lng: -3.8878, slots: 6 },
  { ville: "Tanda", commune: "Tanda", region: "Gontougo", lat: 7.8033, lng: -3.1683, slots: 6 },
  { ville: "M'Bahiakro", commune: "M'Bahiakro", region: "Iffou", lat: 7.4578, lng: -4.3389, slots: 6 },
  { ville: "Bocanda", commune: "Bocanda", region: "N'Zi", lat: 7.0625, lng: -4.4994, slots: 6 },
  { ville: "Tiébissou", commune: "Tiébissou", region: "Bélier", lat: 7.1578, lng: -5.2247, slots: 6 },
  { ville: "Sakassou", commune: "Sakassou", region: "Gbêkê", lat: 7.4547, lng: -5.2928, slots: 6 },
  { ville: "Mankono", commune: "Mankono", region: "Béré", lat: 8.0586, lng: -6.1897, slots: 6 },
  { ville: "Touba", commune: "Touba", region: "Bafing", lat: 8.2833, lng: -7.6833, slots: 6 },
  { ville: "Biankouma", commune: "Biankouma", region: "Tonkpi", lat: 7.7392, lng: -7.6139, slots: 6 },
  { ville: "Bangolo", commune: "Bangolo", region: "Guémon", lat: 7.0122, lng: -7.4867, slots: 6 },
  { ville: "Méagui", commune: "Méagui", region: "Nawa", lat: 5.4167, lng: -6.55, slots: 6 },
  { ville: "Guitry", commune: "Guitry", region: "Lôh-Djiboua", lat: 5.4056, lng: -5.3017, slots: 6 },
  { ville: "Tingréla", commune: "Tingréla", region: "Bagoué", lat: 10.4908, lng: -6.4092, slots: 6 },
  { ville: "Prikro", commune: "Prikro", region: "Iffou", lat: 7.6506, lng: -4.0667, slots: 4 },
  { ville: "Koun-Fao", commune: "Koun-Fao", region: "Gontougo", lat: 7.4878, lng: -3.2525, slots: 4 },
  { ville: "Téhini", commune: "Téhini", region: "Bounkani", lat: 9.6167, lng: -3.6, slots: 4 },
  { ville: "Nassian", commune: "Nassian", region: "Bounkani", lat: 8.8333, lng: -3.4667, slots: 4 },
  { ville: "Minignan", commune: "Minignan", region: "Folon", lat: 9.9972, lng: -7.8356, slots: 4 },
  { ville: "Kani", commune: "Kani", region: "Worodougou", lat: 8.4833, lng: -6.6, slots: 4 },
  { ville: "Sipilou", commune: "Sipilou", region: "Tonkpi", lat: 7.8667, lng: -8.1, slots: 4 },
  { ville: "Zouan-Hounien", commune: "Zouan-Hounien", region: "Tonkpi", lat: 6.9192, lng: -8.2056, slots: 4 },
  { ville: "Toulepleu", commune: "Toulepleu", region: "Cavally", lat: 6.5772, lng: -8.4139, slots: 4 },
  { ville: "Fresco", commune: "Fresco", region: "Gbôklé", lat: 5.0825, lng: -5.5692, slots: 4 },
  { ville: "Buyo", commune: "Buyo", region: "Nawa", lat: 6.2667, lng: -7.05, slots: 4 },
];

export const SITE_PRODUCTION_YOPOUGON = {
  code: "YP",
  libelle: "Usine Stop 3MR — Yopougon",
  pays: "Côte d'Ivoire",
  ville: "Abidjan",
  commune: "Yopougon",
  quartier: "Zone industrielle",
  adresse: "Boulevard Principal, zone industrielle de Yopougon",
  latitude: 5.3284,
  longitude: -4.1039,
};

export const CT_SITES_TARGET = 1000;
export const VENDEUR_COVERAGE = 0.83;

const QUARTIERS = [
  "Commerce",
  "Résidentiel",
  "Gare",
  "Marché",
  "Habitat",
  "Sicogi",
  "SODECI",
  "Lycée",
  "Hôpital",
  "Mairie",
  "Gendarmerie",
  "Carrefour",
  "Extension",
  "Village",
  "Cité",
  "Industrial",
  "Mosquée",
  "Église",
];

const VOIES = [
  "Boulevard Principal",
  "Rue des Écoles",
  "Avenue de la Paix",
  "Route nationale",
  "Rue du Marché",
  "Avenue Houphouët-Boigny",
  "Rue de la Gare",
  "Boulevard de la République",
  "Rue du Stade",
  "Avenue de la Mairie",
];

const PRENOMS = [
  "Kouadio",
  "Awa",
  "Yao",
  "Aminata",
  "Koffi",
  "Fatou",
  "Jean",
  "Mariam",
  "Serge",
  "Adjoua",
  "Ibrahim",
  "Aïcha",
  "Michel",
  "Rokia",
  "Pascal",
  "Nafissatou",
];

const NOMS = [
  "Kouassi",
  "Traoré",
  "Koné",
  "Ouattara",
  "Bamba",
  "Touré",
  "Diallo",
  "N'Guessan",
  "Soro",
  "Cissé",
  "Brou",
  "Fofana",
  "Doh",
  "Kaboré",
  "Yao",
  "Coulibaly",
];

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type CentreGenere = {
  code: string;
  libelle: string;
  pays: string;
  ville: string;
  commune: string;
  quartier: string;
  adresse: string;
  latitude: number;
  longitude: number;
};

export function genererCentresCT(target = CT_SITES_TARGET): CentreGenere[] {
  const rand = mulberry32(20260825);
  const sum = LOCALITES_CI.reduce((s, l) => s + l.slots, 0);
  const scaled = LOCALITES_CI.map((l) => ({
    ...l,
    n: Math.max(1, Math.round((l.slots * target) / sum)),
  }));
  let total = scaled.reduce((s, l) => s + l.n, 0);
  while (total > target) {
    const i = scaled.reduce((best, l, idx) => (l.n > scaled[best].n ? idx : best), 0);
    scaled[i].n -= 1;
    total -= 1;
  }
  while (total < target) {
    const i = Math.floor(rand() * scaled.length);
    scaled[i].n += 1;
    total += 1;
  }

  const centres: CentreGenere[] = [];
  let seq = 1;
  for (const loc of scaled) {
    for (let i = 0; i < loc.n; i++) {
      const code = `CT-${String(seq).padStart(4, "0")}`;
      const quartier = QUARTIERS[Math.floor(rand() * QUARTIERS.length)];
      const voie = VOIES[Math.floor(rand() * VOIES.length)];
      const num = 10 + Math.floor(rand() * 190);
      const jitterLat = (rand() - 0.5) * 0.045;
      const jitterLng = (rand() - 0.5) * 0.045;
      centres.push({
        code,
        libelle: `Centre CT ${loc.commune}${loc.n > 1 ? ` ${i + 1}` : ""}`,
        pays: "Côte d'Ivoire",
        ville: loc.ville,
        commune: loc.commune,
        quartier,
        adresse: `${voie}, n°${num}`,
        latitude: Number((loc.lat + jitterLat).toFixed(6)),
        longitude: Number((loc.lng + jitterLng).toFixed(6)),
      });
      seq += 1;
    }
  }
  return centres;
}

export function nomComplet(u: { prenom?: string | null; nom?: string | null; identifiant?: string }) {
  const full = [u.prenom, u.nom].filter(Boolean).join(" ").trim();
  return full || u.identifiant || "—";
}

export function identitePersonne(index: number, role: "vendeur" | "agent") {
  const prenom = PRENOMS[index % PRENOMS.length];
  const nom = NOMS[Math.floor(index / PRENOMS.length) % NOMS.length];
  return { prenom, nom, libelle: `${prenom} ${nom}` };
}

export function nomPersonne(index: number, role: "vendeur" | "agent") {
  return identitePersonne(index, role).libelle;
}
