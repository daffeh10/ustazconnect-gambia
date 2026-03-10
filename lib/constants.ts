export const SUBJECT_CATEGORIES = [
  {
    category: 'Religious Education',
    subjects: [
      'Quran Reading',
      'Tajweed',
      'Hifz (Memorisation)',
      'Arabic Language',
      'Islamic Studies',
    ],
  },
  {
    category: 'Mathematics',
    subjects: [
      'Basic Mathematics',
      'General Mathematics',
      'Additional Mathematics',
      'Further Mathematics',
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
    subjects: ['WASSCE Prep', 'NAQEB Prep', 'University Entrance'],
  },
] as const

export const ALL_SUBJECTS = SUBJECT_CATEGORIES.flatMap((group) => group.subjects)

export const LOCATION_REGIONS = [
  {
    region: 'Greater Banjul Area',
    locations: [
      'Banjul',
      'Serrekunda',
      'Bakau',
      'Fajara',
      'Kololi',
      'Kotu',
      'Bijilo',
      'Brufut',
      'Sukuta',
      'Brusubi',
      'Kerr Serign',
      'Tallinding',
      'Bundung',
      'Latrikunda',
      'Pipeline',
      'Tabokoto',
      'Kanifing',
    ],
  },
  {
    region: 'West Coast Region',
    locations: [
      'Brikama',
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
