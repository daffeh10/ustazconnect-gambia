export const SUBJECT_CATEGORIES = [
  {
    category: 'Religious Education',
    subjects: [
      'Quran Reading',
      'Tajweed',
      'Hifz (Memorization)',
      'Arabic Language',
      'Islamic Studies',
    ],
  },
  {
    category: 'Mathematics',
    subjects: [
      'General Mathematics',
      'Additional Mathematics',
      'Statistics',
    ],
  },
  {
    category: 'Sciences',
    subjects: [
      'Physics',
      'Chemistry',
      'Biology',
      'Agricultural Science',
      'Computer Science',
    ],
  },
  {
    category: 'Languages',
    subjects: ['English Language', 'English Literature', 'French', 'Arabic'],
  },
  {
    category: 'Humanities',
    subjects: [
      'Economics',
      'Geography',
      'History',
      'Government',
      'Civic Education',
      'Social Studies',
    ],
  },
  {
    category: 'Business',
    subjects: ['Accounting', 'Commerce', 'Business Studies'],
  },
  {
    category: 'Exam Preparation',
    subjects: [
      'WASSCE Prep',
      'Private WASSCE Prep',
      'GABECE Prep',
      'Cambridge Checkpoint Prep',
      'Cambridge IGCSE Prep',
      'SAT Prep',
      'IELTS Prep',
    ],
  },
] as const

export const ALL_SUBJECTS = SUBJECT_CATEGORIES.flatMap((group) => group.subjects)

export const LOCATION_REGIONS = [
  {
    region: 'Banjul City',
    locations: ['Banjul'],
  },
  {
    region: 'Kanifing Municipality',
    locations: [
      'Serrekunda',
      'Bakau',
      'Fajara',
      'Kololi',
      'Kotu',
      'Tallinding',
      'Bundung',
      'Latrikunda German',
      'Latrikunda Sabiji',
      'Pipeline',
      'Tabokoto',
      'Kanifing',
      'Bakoteh',
      'Dippa Kunda',
      'Ebo Town',
      'Old Jeshwang',
      'New Jeshwang',
      'Manjai Kunda',
      'Faji Kunda',
      'Abuko',
    ],
  },
  {
    region: 'West Coast Region',
    locations: [
      'Brikama',
      'Sukuta',
      'Brusubi',
      'Brufut',
      'Bijilo',
      'Kerr Serign',
      'Salagi',
      'Old Yundum',
      'New Yundum',
      'Busumbala',
      'Wellingara',
      'Farato',
      'Jabang',
      'Jambur',
      'Tujereng',
      'Kunkujang',
      'Banjulinding',
      'Mariama Kunda',
      'Gunjur',
      'Sanyang',
      'Kartong',
      'Tanji',
      'Batokunku',
      'Ghana Town',
      'Lamin',
    ],
  },
  {
    region: 'North Bank Region',
    locations: ['Barra', 'Essau', 'Kerewan', 'Farafenni'],
  },
  {
    region: 'Lower River Region',
    locations: ['Mansakonko', 'Soma', 'Pakalinding'],
  },
  {
    region: 'Central River Region',
    locations: ['Janjanbureh', 'Kuntaur', 'Bansang'],
  },
  {
    region: 'Upper River Region',
    locations: ['Basse Santa Su', 'Fatoto'],
  },
] as const

export const ALL_LOCATIONS = LOCATION_REGIONS.flatMap((group) => group.locations)
