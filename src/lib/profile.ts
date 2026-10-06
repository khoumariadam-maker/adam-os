// Single source of truth for contact details and links.
// Leave a field empty ('') to hide it everywhere on the site.
export const PROFILE = {
  name: 'Khoumari Adam',
  nameAr: 'خوماري آدم',
  role: 'Embedded Systems Engineer · Builds with AI',
  roleAr: 'مهندس أنظمة مدمجة · يبني بالذكاء الاصطناعي',
  location: 'Bouira, Algeria',
  email: 'khoumariadam@gmail.com',
  github: 'https://github.com/khoumariadam-maker',
  linkedin: '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://khoumariadam-maker.github.io/adam-os',
  resumes: {
    en: { path: '/resumes/Khoumari_Adam_CV_EN.pdf', download: 'Khoumari_Adam_Resume_EN.pdf' },
    ar: { path: '/resumes/Khoumari_Adam_CV_AR.pdf', download: 'Khoumari_Adam_Resume_AR.pdf' },
  },
} as const;
