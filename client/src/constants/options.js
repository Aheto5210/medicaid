export const NAV_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'General Registration' },
  { key: 'nhis', label: 'NHIS Registration' },
  { key: 'users', label: 'User Management' },
  { key: 'settings', label: 'Settings' }
];

export const HEARD_ABOUT_OPTIONS = [
  'Radio',
  'Other',
  'My child told me',
  'Information van (with megaphones)',
  'On a whatsapp platform',
  'Outreach guys with megaphones',
  'Poster',
  'Influencer (station master/market queen/assembly man)',
  'Church/mosque announcement',
  'Friends/Family (not my child)',
  'Town crier (announcer)'
];

export const OCCUPATION_SUGGESTIONS = [
  'Student',
  'Trader',
  'Farmer',
  'Teacher',
  'Nurse',
  'Doctor',
  'Driver',
  'Hairdresser',
  'Barber',
  'Seamstress',
  'Tailor',
  'Carpenter',
  'Mason',
  'Mechanic',
  'Electrician',
  'Plumber',
  'Security Officer',
  'Cleaner',
  'Caterer',
  'Civil Servant',
  'Business Owner',
  'Entrepreneur',
  'Pastor',
  'Imam',
  'Unemployed',
  'Retired'
];

const TEMA_COMMUNITY_LOCATIONS = Array.from(
  { length: 26 },
  (_, index) => `Tema Community ${index + 1}`
);

const TEMA_LOCATION_SUGGESTIONS = [
  ...TEMA_COMMUNITY_LOCATIONS,
  'Community 22 Annex',
  'Community 25 Annex',
  'Community 25 Extension',
  'Community 25 Ext.',
  'Community 26 Annex',
  'Tema',
  'Tema East',
  'Tema West',
  'Tema Newtown',
  'Tema Manhean',
  'Tema Harbour',
  'Tema Industrial Area',
  'Heavy Industrial Area',
  'Free Zones Enclave',
  'Bankuman',
  'Sakumono',
  'Sakumono Estates',
  'Lashibi',
  'Adjei Kojo',
  'Batsonaa'
];

const KPONE_KATAMANSO_LOCATION_SUGGESTIONS = [
  'Kpone',
  'Kpone on Sea',
  'Kpone Barrier',
  'Kpone Bawaleshie',
  'Kpone Kokompe',
  'Golf City',
  'Golf City Annex',
  'Ashaiman',
  'Michel Camp',
  'Afienya',
  'Afienya Zongo',
  'Gbetsile',
  'Bediako',
  'Sackey',
  'Bulasu',
  'High Tension',
  'Ghana Flag',
  'Zenu',
  'Atadeka',
  'Washington',
  'Peaceland',
  'Down Town',
  'New York',
  'Oyibi',
  'Katamanso',
  'Appolonia',
  'Appolonia City',
  'Kubekro',
  'Santeo',
  'Nanoman',
  'Nii Oglie',
  'Okushibi',
  'Mlitsakpo',
  'Borteyman'
];

const COMMUNITY_25_CORRIDOR_SUGGESTIONS = [
  'Savannah',
  'Savannah Junction',
  'Tararazo',
  'ARS',
  'Adom City',
  'Adom City Estate',
  'Adom Estates',
  'Devtraco Estate',
  'Devtraco Homes',
  'Casilda Estate',
  'HFC Estates',
  'John Gray Estates',
  'Royal Palm Estate',
  'Noble Estate',
  'PS Global Estate',
  'TDC Affordable Estate',
  'Ocean View Estate',
  'Blue Horizon Villas',
  'Emerald Estates',
  'Springfield',
  'Movelle',
  'Junction Mall Area',
  'Central University Area',
  'Queensland',
  'Leisure Street',
  'European Market',
  'Fabrimetal Area',
  'Star Steel Area',
  'Pharmanova Area',
  'RSG Area'
];

const NINGO_PRAMPRAM_LOCATION_SUGGESTIONS = [
  'Dawhenya',
  'New Dawhenya',
  'Old Dawhenya',
  'Dawhenya Irrigation Scheme',
  'Lakpleku',
  'Saglemi',
  'Saglemi Housing',
  'Prampram',
  'Prampram Central',
  'Prampram Beach Area',
  'New Ningo',
  'Old Ningo',
  'Ningo',
  'Miotso',
  'Kasseh',
  'Tsopoli',
  'Dawa',
  'Agortor',
  'Luta',
  'Ahwiam',
  'Sege',
  'Lolonya',
  'Vakpo',
  'Doryumu',
  'Shai Hills'
];

const LOCATION_ALIASES = [
  { label: 'Savanah Junction', value: 'Savannah Junction' }
];

export const LOCATION_SUGGESTIONS = [
  ...LOCATION_ALIASES,
  ...Array.from(new Set([
    ...TEMA_LOCATION_SUGGESTIONS,
    ...KPONE_KATAMANSO_LOCATION_SUGGESTIONS,
    ...COMMUNITY_25_CORRIDOR_SUGGESTIONS,
    ...NINGO_PRAMPRAM_LOCATION_SUGGESTIONS
  ]))
];

export const GENDER_OPTIONS = ['Female', 'Male'];

export const MAIN_REASON_OPTIONS = [
  'NHIS',
  'General Screening',
  'Counseling',
  'Dental',
  'Other',
  'Eye Screening'
];

export const NHIS_SITUATION_CASE_OPTIONS = [
  'New Registration for Adults (18yrs and above)',
  'Renewal for Adults',
  'New Registration for Adults (18yrs and below)',
  'Renewal for below 18yrs',
  'New Registration (with SNNIT ID)',
  'Renewal (with SNNIT ID)',
  'Aged (above 70yrs)',
  'Evidence of pregnancy'
];
