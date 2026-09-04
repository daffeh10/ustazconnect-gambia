// Translations for the tutor registration form.
//
// IMPORTANT: these are LABELS ONLY. Every value written to Supabase stays the
// canonical English string (subjects, locations, languages, age groups, gender,
// education). Storing Arabic would break search, subject matching, the SEO
// pages and the admin screens, which all match on the English values.
//
// Arabic is Modern Standard Arabic. Gambian place names are transliterated into
// Arabic script rather than translated.

export interface TutorRegistrationDictionary {
  locale: 'en' | 'ar'
  dir: 'ltr' | 'rtl'
  switchLabel: string
  switchHref: string

  backToHome: string
  pageTitle: string
  introAccount: string
  introTeaching: string
  introReview: string
  progressLabel: string
  stepAccount: string
  stepTeaching: string
  stepReview: string

  nameLabel: string
  namePlaceholder: string
  nameHelper: string
  genderLabel: string
  genderPlaceholder: string
  genderHelper: string
  phoneLabel: string
  phonePlaceholder: string
  phoneHelper: string
  locationLabel: string
  locationPlaceholder: string
  locationHelper: string
  emailLabel: string
  emailPlaceholder: string
  emailHelper: string
  passwordLabel: string
  passwordPlaceholder: string
  passwordHelper: string
  confirmPasswordLabel: string
  confirmPasswordPlaceholder: string

  hourlyRateLabel: string
  hourlyRatePlaceholder: string
  travelRadiusLabel: string
  areasLabel: string
  areasPlaceholder: string
  areasHelper: string
  languagesLabel: string
  languagesHelper: string
  ageGroupsLabel: string
  educationLabel: string
  educationPlaceholder: string
  experienceLabel: string
  experiencePlaceholder: string
  bioLabel: string
  bioPlaceholder: string
  bioHelper: string
  subjectsLabel: string
  subjectsPlaceholder: string
  subjectsHelper: string
  onlineTitle: string
  onlineHelper: string

  reviewAccountHeading: string
  reviewTeachingHeading: string
  edit: string
  reviewName: string
  reviewPhone: string
  reviewEmail: string
  reviewLocation: string
  reviewSubjects: string
  reviewRate: string
  reviewAreas: string
  reviewLanguages: string
  reviewBio: string
  reviewBioEmpty: string
  reviewOnline: string
  yes: string
  no: string

  consentText: string
  termsLink: string
  privacyLink: string
  and: string

  back: string
  continueToTeaching: string
  reviewDetails: string
  createAccount: string
  creating: string

  errIncomplete: string
  errPhone: string
  errPassword: string
  errPasswordMatch: string
  errRateMissing: string
  errSubjects: string
  errLanguages: string
  errExperience: string
  errConsent: string
  errGeneric: string

  successTitle: string
  successBody: string
  successHelp: string
  questions: string
  resend: string
  resending: string
  registerFamily: string
  alreadyHaveAccount: string
  signIn: string
  noMatches: string
  remove: string
}

export const EN_TUTOR_REGISTRATION: TutorRegistrationDictionary = {
  locale: 'en',
  dir: 'ltr',
  switchLabel: 'العربية',
  switchHref: '/register/tutor/ar',

  backToHome: '\u2190 Back to Home',
  pageTitle: 'Create Your Tutor Account',
  introAccount:
    'Start with your account and contact details. You can then add the information families need when choosing a tutor.',
  introTeaching:
    'Tell families what you teach, where you can teach, and the learners you work with.',
  introReview:
    'Check your information before creating your account. You can update your profile and submit review documents from your tutor dashboard.',
  progressLabel: 'Registration progress',
  stepAccount: 'Account',
  stepTeaching: 'Teaching Profile',
  stepReview: 'Review',

  nameLabel: 'Full Name *',
  namePlaceholder: 'First and last name as shown on your ID',
  nameHelper: 'Use your first and last name exactly as they appear on your ID document.',
  genderLabel: 'Gender *',
  genderPlaceholder: 'Select gender',
  genderHelper:
    'Your gender will be shown on your public tutor profile to help families choose a suitable tutor.',
  phoneLabel: 'Phone Number *',
  phonePlaceholder: '7 digits after +220',
  phoneHelper:
    'This is your main tutor contact number. Families only get it after the first lesson is booked.',
  locationLabel: 'Location / Area *',
  locationPlaceholder: 'Select the main area where you teach',
  locationHelper:
    'We collect your main teaching area, not your exact home address, to protect your privacy.',
  emailLabel: 'Email Address *',
  emailPlaceholder: 'you@example.com',
  emailHelper:
    'Secondary contact for now. We still use email to create and secure tutor accounts until phone login is enabled.',
  passwordLabel: 'Password *',
  passwordPlaceholder: 'Minimum 8 characters',
  passwordHelper: 'Use at least 8 characters. A short passphrase is even better.',
  confirmPasswordLabel: 'Confirm Password *',
  confirmPasswordPlaceholder: 'Re-enter your password',

  hourlyRateLabel: 'Hourly Rate (GMD) *',
  hourlyRatePlaceholder: 'e.g. 150',
  travelRadiusLabel: 'Travel Radius',
  areasLabel: 'Areas Covered',
  areasPlaceholder: 'Search and add teaching areas',
  areasHelper: 'Add every area you are willing to travel to for in-person lessons.',
  languagesLabel: 'Languages You Can Teach / Communicate In *',
  languagesHelper:
    'The site stays in English, but you should select the real languages you personally use with students, such as Arabic, Wolof, Mandinka, or English.',
  ageGroupsLabel: 'Age Groups',
  educationLabel: 'Education',
  educationPlaceholder: 'Select education level',
  experienceLabel: 'Experience Years',
  experiencePlaceholder: 'e.g. 5',
  bioLabel: 'About You',
  bioPlaceholder: 'Tell families about your teaching style and experience.',
  bioHelper:
    'Optional, and you can add it later. This is the first thing a family reads on your profile, so a few honest sentences help them choose you.',
  subjectsLabel: 'Subjects You Teach *',
  subjectsPlaceholder: 'Search and add subjects',
  subjectsHelper: 'Add the subjects you are comfortable teaching.',
  onlineTitle: 'I also offer online lessons',
  onlineHelper: 'Families will see an online badge on your profile and card.',

  reviewAccountHeading: 'Account',
  reviewTeachingHeading: 'Teaching Profile',
  edit: 'Edit',
  reviewName: 'Name',
  reviewPhone: 'Phone',
  reviewEmail: 'Email',
  reviewLocation: 'Main area',
  reviewSubjects: 'Subjects',
  reviewRate: 'Hourly rate',
  reviewAreas: 'Teaching areas',
  reviewLanguages: 'Languages',
  reviewBio: 'About you',
  reviewBioEmpty: 'Not added yet',
  reviewOnline: 'Online lessons',
  yes: 'Yes',
  no: 'No',

  consentText:
    'I confirm that my profile details are accurate, I agree to be contacted for tutoring requests, and I accept the',
  termsLink: 'Terms of Service',
  privacyLink: 'Privacy Policy',
  and: 'and',

  back: 'Back',
  continueToTeaching: 'Continue to Teaching Profile',
  reviewDetails: 'Review Details',
  createAccount: 'Create Tutor Account',
  creating: 'Creating account...',

  errIncomplete: 'Please complete all fields before continuing.',
  errPhone: 'Please enter a valid 7-digit Gambian phone number after +220.',
  errPassword: 'Password must be at least 8 characters long.',
  errPasswordMatch: 'Passwords do not match.',
  errRateMissing: 'Please enter your hourly rate.',
  errSubjects: 'Please select at least one subject you can teach.',
  errLanguages: 'Please select at least one language you can teach or communicate in.',
  errExperience: 'Experience years must be a valid non-negative number.',
  errConsent: 'Please confirm your tutor profile details and agree to the platform terms.',
  errGeneric: 'We could not create your account. Please check your details and try again.',

  successTitle: 'Check your email',
  successBody: 'We sent a confirmation link to your inbox. Please verify your email to continue.',
  successHelp:
    'If you do not see it within a few minutes, check spam or use the resend button below. After you confirm your email and sign in, you can use your dashboard to track your profile status, upload your photo and review documents, and see any next steps for approval.',
  questions: 'Questions:',
  resend: 'Resend confirmation email',
  resending: 'Resending...',
  registerFamily: 'Register as Family/Student',
  alreadyHaveAccount: 'Already have an account?',
  signIn: 'Sign in',
  noMatches: 'No matching options.',
  remove: 'Remove',
}

export const AR_TUTOR_REGISTRATION: TutorRegistrationDictionary = {
  locale: 'ar',
  dir: 'rtl',
  switchLabel: 'English',
  switchHref: '/register/tutor',

  backToHome: '\u2192 \u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
  pageTitle: 'إنشاء حساب معلّم',
  introAccount:
    'ابدأ ببيانات حسابك ووسائل التواصل معك، ثم أضِف المعلومات التي تحتاجها الأسر عند اختيار المعلّم.',
  introTeaching:
    'أخبِر الأسر بالمواد التي تُدرّسها، والمناطق التي يمكنك التدريس فيها، والفئات التي تعمل معها.',
  introReview:
    'راجِع معلوماتك قبل إنشاء الحساب. يمكنك تعديل ملفك ورفع مستندات المراجعة من لوحة تحكّم المعلّم.',
  progressLabel: 'مراحل التسجيل',
  stepAccount: 'الحساب',
  stepTeaching: 'الملف التعليمي',
  stepReview: 'المراجعة',

  nameLabel: 'الاسم الكامل *',
  namePlaceholder: 'الاسم الأول واسم العائلة كما في بطاقة الهوية',
  nameHelper: 'اكتب اسمك الأول واسم عائلتك تمامًا كما يظهران في وثيقة هويتك.',
  genderLabel: 'الجنس *',
  genderPlaceholder: 'اختر الجنس',
  genderHelper: 'سيظهر الجنس في ملفك العام لمساعدة الأسر على اختيار المعلّم المناسب.',
  phoneLabel: 'رقم الهاتف *',
  phonePlaceholder: 'سبعة أرقام بعد مقدّمة الدولة',
  phoneHelper: 'هذا رقمك الأساسي للتواصل. لا تحصل عليه الأسر إلا بعد حجز أول درس.',
  locationLabel: 'الموقع / المنطقة *',
  locationPlaceholder: 'اختر المنطقة الرئيسية التي تُدرّس فيها',
  locationHelper:
    'نجمع منطقة التدريس الرئيسية فقط، لا عنوان سكنك الدقيق، حفاظًا على خصوصيتك.',
  emailLabel: 'البريد الإلكتروني *',
  emailPlaceholder: 'you@example.com',
  emailHelper:
    'وسيلة تواصل ثانوية في الوقت الحالي. ما زلنا نستخدم البريد الإلكتروني لإنشاء حسابات المعلّمين وتأمينها إلى أن يُتاح تسجيل الدخول برقم الهاتف.',
  passwordLabel: 'كلمة المرور *',
  passwordPlaceholder: 'ثمانية أحرف كحدّ أدنى',
  passwordHelper: 'استخدم ثمانية أحرف على الأقل، ويُفضَّل اختيار عبارة قصيرة يسهل تذكّرها.',
  confirmPasswordLabel: 'تأكيد كلمة المرور *',
  confirmPasswordPlaceholder: 'أعِد إدخال كلمة المرور',

  hourlyRateLabel: 'الأجر في الساعة (بالدلاسي) *',
  hourlyRatePlaceholder: 'مثال: 150',
  travelRadiusLabel: 'مسافة التنقّل',
  areasLabel: 'المناطق التي تغطّيها',
  areasPlaceholder: 'ابحث وأضِف مناطق التدريس',
  areasHelper: 'أضِف كل منطقة أنت مستعدّ للتنقّل إليها لإعطاء الدروس الحضورية.',
  languagesLabel: 'اللغات التي تُدرّس بها أو تتواصل بها *',
  languagesHelper:
    'اختر اللغات التي تستخدمها فعليًا مع الطلاب، مثل العربية أو الولوفية أو الماندينكية أو الإنجليزية.',
  ageGroupsLabel: 'الفئات العمرية',
  educationLabel: 'المؤهل العلمي',
  educationPlaceholder: 'اختر المؤهل العلمي',
  experienceLabel: 'سنوات الخبرة',
  experiencePlaceholder: 'مثال: 5',
  bioLabel: 'نبذة عنك',
  bioPlaceholder: 'عرِّف الأسر بأسلوبك في التدريس وخبرتك.',
  bioHelper:
    'اختياري، ويمكنك إضافته لاحقًا. هذه أول ما تقرؤه الأسرة في ملفك، فبضع جُمل صادقة تساعدها على اختيارك.',
  subjectsLabel: 'المواد التي تُدرّسها *',
  subjectsPlaceholder: 'ابحث وأضِف المواد',
  subjectsHelper: 'أضِف المواد التي تشعر بالارتياح في تدريسها.',
  onlineTitle: 'أُقدّم دروسًا عبر الإنترنت أيضًا',
  onlineHelper: 'ستظهر علامة الدروس عبر الإنترنت في ملفك وبطاقتك.',

  reviewAccountHeading: 'الحساب',
  reviewTeachingHeading: 'الملف التعليمي',
  edit: 'تعديل',
  reviewName: 'الاسم',
  reviewPhone: 'الهاتف',
  reviewEmail: 'البريد الإلكتروني',
  reviewLocation: 'المنطقة الرئيسية',
  reviewSubjects: 'المواد',
  reviewRate: 'الأجر في الساعة',
  reviewAreas: 'مناطق التدريس',
  reviewLanguages: 'اللغات',
  reviewBio: 'نبذة عنك',
  reviewBioEmpty: 'لم تُضَف بعد',
  reviewOnline: 'دروس عبر الإنترنت',
  yes: 'نعم',
  no: 'لا',

  consentText:
    'أُقِرّ بأن بيانات ملفي صحيحة، وأوافق على أن يتم التواصل معي بشأن طلبات التدريس، وأقبل',
  termsLink: 'شروط الخدمة',
  privacyLink: 'سياسة الخصوصية',
  and: 'و',

  back: 'رجوع',
  continueToTeaching: 'المتابعة إلى الملف التعليمي',
  reviewDetails: 'مراجعة البيانات',
  createAccount: 'إنشاء حساب المعلّم',
  creating: 'جارٍ إنشاء الحساب...',

  errIncomplete: 'يرجى إكمال جميع الحقول قبل المتابعة.',
  errPhone: 'يرجى إدخال رقم هاتف غامبي صحيح مكوّن من سبعة أرقام بعد مقدّمة الدولة.',
  errPassword: 'يجب ألّا تقلّ كلمة المرور عن ثمانية أحرف.',
  errPasswordMatch: 'كلمتا المرور غير متطابقتين.',
  errRateMissing: 'يرجى إدخال أجرك في الساعة.',
  errSubjects: 'يرجى اختيار مادة واحدة على الأقل تستطيع تدريسها.',
  errLanguages: 'يرجى اختيار لغة واحدة على الأقل تُدرّس بها أو تتواصل بها.',
  errExperience: 'يجب أن تكون سنوات الخبرة رقمًا صحيحًا غير سالب.',
  errConsent: 'يرجى تأكيد صحة بيانات ملفك والموافقة على شروط المنصّة.',
  errGeneric: 'تعذّر إنشاء حسابك. يرجى التحقّق من بياناتك والمحاولة مرة أخرى.',

  successTitle: 'تحقّق من بريدك الإلكتروني',
  successBody: 'أرسلنا رابط التأكيد إلى بريدك الإلكتروني. يرجى تأكيد بريدك للمتابعة.',
  successHelp:
    'إن لم تجد الرسالة خلال دقائق، فتحقّق من مجلد البريد غير المرغوب فيه أو استخدم زر إعادة الإرسال أدناه. بعد تأكيد بريدك وتسجيل الدخول، يمكنك من لوحة التحكّم متابعة حالة ملفك، ورفع صورتك ومستندات المراجعة، ومعرفة الخطوات التالية للاعتماد.',
  questions: 'للاستفسار:',
  resend: 'إعادة إرسال رسالة التأكيد',
  resending: 'جارٍ إعادة الإرسال...',
  registerFamily: 'التسجيل كأسرة أو طالب',
  alreadyHaveAccount: 'لديك حساب بالفعل؟',
  signIn: 'تسجيل الدخول',
  noMatches: 'لا توجد نتائج مطابقة.',
  remove: 'إزالة',
}

// ─── Value label maps ────────────────────────────────────────────────────────
// Keys are the canonical English values stored in Supabase.

export const AR_SUBJECT_LABELS: Record<string, string> = {
  'Quran Reading with Tajweed': 'تلاوة القرآن بالتجويد',
  'Hifz (Quran memorisation)': 'حفظ القرآن الكريم',
  'Islamic Studies': 'التربية الإسلامية',
  'General Mathematics': 'الرياضيات العامة',
  'Additional Mathematics': 'الرياضيات الإضافية',
  Statistics: 'الإحصاء',
  Physics: 'الفيزياء',
  Chemistry: 'الكيمياء',
  Biology: 'الأحياء',
  'Agricultural Science': 'العلوم الزراعية',
  'Computer Science': 'علوم الحاسوب',
  'English Language': 'اللغة الإنجليزية',
  'English Literature': 'الأدب الإنجليزي',
  French: 'اللغة الفرنسية',
  'Arabic Language': 'اللغة العربية',
  Economics: 'الاقتصاد',
  Geography: 'الجغرافيا',
  History: 'التاريخ',
  Government: 'النظم السياسية',
  'Civic Education': 'التربية المدنية',
  'Social Studies': 'الدراسات الاجتماعية',
  Accounting: 'المحاسبة',
  Commerce: 'التجارة',
  'Business Studies': 'إدارة الأعمال',
  'WASSCE Prep': 'التحضير لامتحان WASSCE',
  'Private WASSCE Prep': 'التحضير لامتحان WASSCE (للمنتسبين)',
  'GABECE Prep': 'التحضير لامتحان GABECE',
  'Cambridge Checkpoint Prep': 'التحضير لاختبار كامبريدج تشيك بوينت',
  'Cambridge IGCSE Prep': 'التحضير لشهادة كامبريدج IGCSE',
  'SAT Prep': 'التحضير لاختبار SAT',
  'IELTS Prep': 'التحضير لاختبار IELTS',
}

export const AR_LOCATION_LABELS: Record<string, string> = {
  Banjul: 'بانجول',
  Serrekunda: 'سيري كوندا',
  Bakau: 'باكاو',
  Fajara: 'فاجارا',
  Kololi: 'كولولي',
  Kotu: 'كوتو',
  Tallinding: 'تالندينغ',
  Bundung: 'بوندونغ',
  'Latrikunda German': 'لاتري كوندا جيرمان',
  'Latrikunda Sabiji': 'لاتري كوندا سابيجي',
  Pipeline: 'بايبلاين',
  Tabokoto: 'تابوكوتو',
  Kanifing: 'كانيفينغ',
  Bakoteh: 'باكوتيه',
  'Dippa Kunda': 'ديبا كوندا',
  'Ebo Town': 'إيبو تاون',
  'Old Jeshwang': 'جيشوانغ القديمة',
  'New Jeshwang': 'جيشوانغ الجديدة',
  'Manjai Kunda': 'مانجاي كوندا',
  'Faji Kunda': 'فاجي كوندا',
  Abuko: 'أبوكو',
  Brikama: 'بريكاما',
  Sukuta: 'سوكوتا',
  Brusubi: 'بروسوبي',
  Brufut: 'بروفوت',
  Bijilo: 'بيجيلو',
  'Kerr Serign': 'كير سيرين',
  Salagi: 'سالاجي',
  'Old Yundum': 'يوندوم القديمة',
  'New Yundum': 'يوندوم الجديدة',
  Busumbala: 'بوسومبالا',
  Wellingara: 'ولينغارا',
  Farato: 'فاراتو',
  Jabang: 'جابانغ',
  Jambur: 'جامبور',
  Tujereng: 'توجيرينغ',
  Kunkujang: 'كونكوجانغ',
  Banjulinding: 'بانجولندينغ',
  'Mariama Kunda': 'مريمة كوندا',
  Gunjur: 'غونجور',
  Sanyang: 'سانيانغ',
  Kartong: 'كارتونغ',
  Tanji: 'تانجي',
  Batokunku: 'باتوكونكو',
  'Ghana Town': 'غانا تاون',
  Lamin: 'لامين',
  Barra: 'بارا',
  Essau: 'إيساو',
  Kerewan: 'كيريوان',
  Farafenni: 'فارافيني',
  Mansakonko: 'مانساكونكو',
  Soma: 'سوما',
  Pakalinding: 'باكاليندينغ',
  Janjanbureh: 'جانجانبوريه',
  Kuntaur: 'كونتاور',
  Bansang: 'بانسانغ',
  'Basse Santa Su': 'باسي سانتا سو',
  Fatoto: 'فاتوتو',
}

export const AR_REGION_LABELS: Record<string, string> = {
  'Banjul City': 'مدينة بانجول',
  'Kanifing Municipality': 'بلدية كانيفينغ',
  'West Coast Region': 'منطقة الساحل الغربي',
  'North Bank Region': 'منطقة الضفة الشمالية',
  'Lower River Region': 'منطقة النهر السفلى',
  'Central River Region': 'منطقة النهر الوسطى',
  'Upper River Region': 'منطقة النهر العليا',
}

export const AR_LANGUAGE_LABELS: Record<string, string> = {
  English: 'الإنجليزية',
  Wolof: 'الولوفية',
  Mandinka: 'الماندينكية',
  Fula: 'الفولانية',
  Jola: 'الجولا',
  Arabic: 'العربية',
  French: 'الفرنسية',
  Other: 'أخرى',
}

export const AR_AGE_GROUP_LABELS: Record<string, string> = {
  'Children 5-12': 'الأطفال (5 – 12 سنة)',
  'Teens 13-17': 'المراهقون (13 – 17 سنة)',
  'Adults 18+': 'البالغون (18 سنة فأكثر)',
}

export const AR_GENDER_LABELS: Record<string, string> = {
  Male: 'ذكر',
  Female: 'أنثى',
}

export const AR_EDUCATION_LABELS: Record<string, string> = {
  Secondary: 'الثانوية',
  Diploma: 'دبلوم',
  "Bachelor's": 'بكالوريوس',
  "Master's": 'ماجستير',
  PhD: 'دكتوراه',
  'Islamic Seminary': 'معهد شرعي',
  Other: 'أخرى',
}

/** Returns the Arabic label for a stored English value, or the value itself. */
export function arabicLabel(map: Record<string, string>, value: string) {
  return map[value] ?? value
}

/** Formats a travel radius option label, e.g. "5 km" -> "5 كم". */
export function arabicRadiusLabel(label: string) {
  return label.replace('km', 'كم')
}
