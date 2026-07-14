/**
 * Comprehensive Medicines Database for India
 * Includes generic names, brand names, and common use cases
 * Format: { generic, brands[], uses[] }
 */

export const MEDICINES_DATABASE = [
  // Antipyretics & Analgesics
  {
    generic: 'Paracetamol',
    brands: ['Crocin', 'Dolo', 'Acetaminophen', 'Panadol'],
    uses: ['fever', 'headache', 'pain', 'cold', 'mild pain'],
  },
  {
    generic: 'Ibuprofen',
    brands: ['Brufen', 'Ibugesic', 'Ibopain'],
    uses: ['pain', 'fever', 'inflammation', 'muscle pain'],
  },
  {
    generic: 'Aspirin',
    brands: ['Ecosprin', 'Disprin'],
    uses: ['pain', 'fever', 'heart protection', 'blood thinning'],
  },

  // Antibiotics
  {
    generic: 'Amoxicillin',
    brands: ['Amoxycillin', 'Acillin', 'Almox'],
    uses: ['bacterial infection', 'throat infection', 'ear infection', 'urinary tract infection'],
  },
  {
    generic: 'Azithromycin',
    brands: ['Azithral', 'Zetro', 'Zithromax', 'Azi'],
    uses: ['respiratory infection', 'throat infection', 'skin infection', 'chest infection'],
  },
  {
    generic: 'Ciprofloxacin',
    brands: ['Cipro', 'Ciprolet', 'Cifran'],
    uses: ['urinary tract infection', 'bacterial infection', 'diarrhea', 'respiratory infection'],
  },
  {
    generic: 'Cephalexin',
    brands: ['Keflex', 'Solcef'],
    uses: ['bacterial infection', 'throat infection', 'skin infection'],
  },

  // Cough & Cold
  {
    generic: 'Cetirizine',
    brands: ['Allegra', 'Cetifed', 'Cetrizine', 'Okacet'],
    uses: ['allergy', 'cold', 'itching', 'sneezing', 'runny nose'],
  },
  {
    generic: 'Dextromethorphan',
    brands: ['Robitussin', 'Benadryl', 'Nextar'],
    uses: ['cough', 'dry cough', 'cold'],
  },
  {
    generic: 'Ambroxol',
    brands: ['Mucosolvan', 'Ambrox', 'Ambrohexal'],
    uses: ['cough', 'mucus clearance', 'cold', 'bronchitis'],
  },

  // Gastrointestinal
  {
    generic: 'Omeprazole',
    brands: ['Prilosec', 'Omez', 'Losec'],
    uses: ['acid reflux', 'ulcer', 'heartburn', 'gastric pain'],
  },
  {
    generic: 'Ranitidine',
    brands: ['Ranitin', 'Aciloc'],
    uses: ['acid reflux', 'heartburn', 'ulcer', 'gastric pain'],
  },
  {
    generic: 'Antacid (Magnesium + Aluminum)',
    brands: ['Digene', 'Gelusil', 'Kolantyl'],
    uses: ['heartburn', 'acidity', 'gastric pain'],
  },

  // Vitamins & Supplements
  {
    generic: 'Vitamin B12',
    brands: ['Cobadex', 'Crystamin', 'Neurobion'],
    uses: ['vitamin deficiency', 'anemia', 'nerve pain', 'weakness'],
  },
  {
    generic: 'Vitamin B Complex',
    brands: ['Neurobion', 'B-Plex'],
    uses: ['vitamin deficiency', 'weakness', 'nerve pain', 'energy'],
  },
  {
    generic: 'Iron Supplement',
    brands: ['Ferrous Sulfate', 'Feroglobin', 'Ironorm'],
    uses: ['anemia', 'iron deficiency', 'weakness'],
  },
  {
    generic: 'Calcium',
    brands: ['Calcibex', 'Shelcal', 'Calcimax'],
    uses: ['bone health', 'calcium deficiency', 'osteoporosis'],
  },

  // Diabetes
  {
    generic: 'Metformin',
    brands: ['Glucophage', 'Glycomet', 'Diaglip'],
    uses: ['diabetes', 'blood sugar control'],
  },
  {
    generic: 'Glibenclamide',
    brands: ['Daonil', 'Gliben'],
    uses: ['diabetes', 'blood sugar control'],
  },

  // Hypertension
  {
    generic: 'Amlodipine',
    brands: ['Norvasc', 'Amlodac', 'Amphexal'],
    uses: ['high blood pressure', 'hypertension', 'heart disease'],
  },
  {
    generic: 'Lisinopril',
    brands: ['Prinivil', 'Lizipin'],
    uses: ['high blood pressure', 'heart disease'],
  },
  {
    generic: 'Atenolol',
    brands: ['Atenova', 'Amlotop'],
    uses: ['high blood pressure', 'heart disease', 'anxiety'],
  },

  // Antihistamines
  {
    generic: 'Diphenhydramine',
    brands: ['Benadryl', 'Somnil'],
    uses: ['allergy', 'itching', 'sleep', 'antihistamine'],
  },

  // Anti-inflammatory
  {
    generic: 'Diclofenac',
    brands: ['Voveran', 'Diclo', 'Diclofan'],
    uses: ['pain', 'inflammation', 'muscle pain', 'arthritis'],
  },
  {
    generic: 'Naproxen',
    brands: ['Naprosyn'],
    uses: ['pain', 'inflammation', 'arthritis', 'muscle pain'],
  },

  // Antacid & Antigas
  {
    generic: 'Simethicone',
    brands: ['Simcol', 'Gasex'],
    uses: ['gas', 'bloating', 'indigestion'],
  },

  // Antihypertensive
  {
    generic: 'Nifedipine',
    brands: ['Adalat', 'Nife'],
    uses: ['high blood pressure', 'heart disease', 'angina'],
  },

  // Antibiotic Topical
  {
    generic: 'Neomycin + Polymyxin',
    brands: ['Polysporin', 'Neosporin'],
    uses: ['skin infection', 'wound infection', 'antimicrobial'],
  },

  // AntiEmetic
  {
    generic: 'Ondansetron',
    brands: ['Emeset', 'Ondem'],
    uses: ['nausea', 'vomiting', 'motion sickness'],
  },

  // Thyroid
  {
    generic: 'Levothyroxine',
    brands: ['Thyronorm', 'Eltroxin'],
    uses: ['hypothyroidism', 'thyroid', 'hormone replacement'],
  },
];

/**
 * Search/filter medicines by name or use case
 */
export function searchMedicines(query) {
  if (!query || query.length === 0) return [];

  const q = query.toLowerCase().trim();

  return MEDICINES_DATABASE.filter(med => {
    const genericMatch = med.generic.toLowerCase().includes(q);
    const brandMatch = med.brands.some(b => b.toLowerCase().includes(q));
    const usesMatch = med.uses.some(u => u.includes(q));

    return genericMatch || brandMatch || usesMatch;
  });
}

/**
 * Get suggestions with ranking (generic first, then brands)
 */
export function getMedicineSuggestions(query, limit = 10) {
  const results = searchMedicines(query);

  // Rank by relevance
  return results
    .map(med => {
      const q = query.toLowerCase();
      let score = 0;

      // Exact generic match = highest score
      if (med.generic.toLowerCase() === q) score = 1000;
      // Generic starts with query
      else if (med.generic.toLowerCase().startsWith(q)) score = 500;
      // Generic includes query
      else if (med.generic.toLowerCase().includes(q)) score = 300;

      // Brand exact match
      if (med.brands.some(b => b.toLowerCase() === q)) score = Math.max(score, 900);
      // Brand starts with query
      else if (med.brands.some(b => b.toLowerCase().startsWith(q))) score = Math.max(score, 400);

      return { ...med, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...med }) => med);
}
