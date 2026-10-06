// Project case studies shown in Projects.exe. Facts mirror the résumé (src/lib/content/resume.ts).
//
// To add a photo: put it in public/projects/<id>.jpg (≈1200x675) and set `image: '/projects/<id>.jpg'`.
// To add links: fill `links` with { label, href } (GitHub repo, demo video, live site...).

import type { IconName } from '@/lib/pixel-icons';

type L10n = { en: string; ar: string };

export interface Project {
  id: string;
  // Pixel icon shown on the generated cover and in the list.
  icon: IconName;
  accent: string;
  title: L10n;
  tagline: L10n;
  kind: L10n;
  context: L10n;
  built: { en: string[]; ar: string[] };
  outcome: L10n;
  stack: string[];
  image?: string;
  links: Array<{ label: string; href: string }>;
  // Opens a related app window (e.g. the irrigation simulator in Lab.exe).
  relatedApp?: 'lab';
}

export const PROJECTS: Project[] = [
  {
    id: 'smart-irrigation',
    icon: 'lab',
    accent: '#72FFB4',
    title: { en: 'Smart Irrigation', ar: 'نظام الري الذكي' },
    tagline: {
      en: 'AI-assisted plant monitoring on an ESP32.',
      ar: 'مراقبة النباتات بمساعدة الذكاء الاصطناعي على ESP32.',
    },
    kind: { en: 'Hardware + ML', ar: 'عتاد + تعلم آلي' },
    context: {
      en: 'Plants get watered on a schedule, not on what the soil actually needs. I wanted a small device that measures first and decides second.',
      ar: 'غالباً ما تُسقى النباتات حسب جدول ثابت لا حسب حاجة التربة الفعلية. أردت جهازاً صغيراً يقيس أولاً ثم يقرّر.',
    },
    built: {
      en: [
        'ESP32 reading a DHT22 (air temperature + humidity) and a capacitive soil-moisture sensor.',
        'Readings streamed to Firebase in real time.',
        'Web dashboard showing live sensor data.',
        'ML model that predicts the plant type from the sensor readings.',
      ],
      ar: [
        'بطاقة ESP32 تقرأ مستشعر DHT22 (حرارة ورطوبة الهواء) ومستشعر رطوبة التربة.',
        'إرسال القراءات إلى Firebase في الوقت الحقيقي.',
        'لوحة ويب تعرض بيانات المستشعرات مباشرة.',
        'نموذج تعلم آلي يتنبأ بنوع النبتة انطلاقاً من القراءات.',
      ],
    },
    outcome: {
      en: 'End-to-end IoT pipeline: sensor → microcontroller → cloud → web → model. Try the simulated version in Lab.exe.',
      ar: 'سلسلة إنترنت أشياء كاملة: مستشعر ← متحكم ← سحابة ← ويب ← نموذج. جرّب النسخة المحاكاة في Lab.exe.',
    },
    stack: ['ESP32', 'DHT22', 'Soil sensor', 'Firebase', 'Web app', 'ML'],
    links: [],
    relatedApp: 'lab',
  },
  {
    id: 'race-challenge',
    icon: 'chip',
    accent: '#FFE55C',
    title: { en: 'Race Challenge — ESP32 Robot Cars', ar: 'تحدي السباق — سيارات ESP32 الروبوتية' },
    tagline: {
      en: '4-day workshop: from zero electronics to racing your own robot.',
      ar: 'ورشة 4 أيام: من الصفر في الإلكترونيك إلى سباق روبوتك الخاص.',
    },
    kind: { en: 'Workshop · Scientific Club Afaq', ar: 'ورشة · النادي العلمي آفاق' },
    context: {
      en: 'Most participants had never touched a breadboard. The goal: everyone leaves with a car they built, wired and programmed themselves.',
      ar: 'أغلب المشاركين لم يلمسوا لوحة تجارب من قبل. الهدف: أن يغادر الجميع بسيارة بنوها وبرمجوها بأنفسهم.',
    },
    built: {
      en: [
        'Designed the 4-day curriculum and ran every workshop.',
        'Smart cars on ESP32 + motor drivers, controlled from a mobile app over Bluetooth.',
        'Two modes: optical line-following and Rocket League-style robot soccer.',
        'Debugged 30+ projects live during the event.',
      ],
      ar: [
        'تصميم منهج الأيام الأربعة وتنشيط كل الورشات.',
        'سيارات ذكية بـ ESP32 ومشغّلات محركات، يُتحكم فيها بتطبيق هاتف عبر البلوتوث.',
        'وضعان: تتبع الخط بصرياً، وكرة قدم روبوتية على طريقة Rocket League.',
        'تصحيح أكثر من 30 مشروعاً مباشرة أثناء الحدث.',
      ],
    },
    outcome: {
      en: '30+ participants went from zero to a working bot and finished with a live robot-soccer tournament.',
      ar: 'أكثر من 30 مشاركاً انتقلوا من الصفر إلى روبوت يعمل، واختُتم الحدث ببطولة كرة قدم روبوتية مباشرة.',
    },
    stack: ['ESP32', 'Bluetooth', 'Motor drivers', 'Mobile app', 'Teaching'],
    links: [],
  },
  {
    id: 'rpi-selfhost',
    icon: 'desktop',
    accent: '#C3C6ED',
    title: { en: 'Raspberry Pi Self-Host', ar: 'خادم Raspberry Pi ذاتي الاستضافة' },
    tagline: {
      en: 'A home-lab Linux server replacing a paid VPS.',
      ar: 'خادم Linux منزلي يعوّض خادماً افتراضياً مدفوعاً.',
    },
    kind: { en: 'Home lab · running 24/7', ar: 'مختبر منزلي · يعمل 24/7' },
    context: {
      en: 'AI agents and side projects need somewhere to run all the time — without a monthly cloud bill.',
      ar: 'وكلاء الذكاء الاصطناعي والمشاريع الجانبية تحتاج مكاناً تعمل فيه باستمرار — بدون فاتورة سحابية شهرية.',
    },
    built: {
      en: [
        'Headless Linux on a Raspberry Pi, managed over SSH.',
        'Docker containers for side projects and services.',
        'Cron jobs for automation; doubles as a personal cloud.',
      ],
      ar: [
        'نظام Linux بدون شاشة على Raspberry Pi، يُدار عبر SSH.',
        'حاويات Docker للمشاريع الجانبية والخدمات.',
        'مهام Cron للأتمتة، ويعمل أيضاً كسحابة شخصية.',
      ],
    },
    outcome: {
      en: 'Runs my AI agents 24/7 with no subscription costs.',
      ar: 'يشغّل وكلائي الذكيين 24/7 بدون أي اشتراك.',
    },
    stack: ['Linux', 'SSH', 'Docker', 'Cron', 'Raspberry Pi'],
    links: [],
  },
  {
    id: 'agentic-dev-team',
    icon: 'spider',
    accent: '#212CF4',
    title: { en: 'Agentic Dev Team', ar: 'فريق تطوير من الوكلاء الأذكياء' },
    tagline: {
      en: 'A multi-agent workflow that works like a small software team.',
      ar: 'سير عمل متعدد الوكلاء يعمل كفريق برمجيات صغير.',
    },
    kind: { en: 'AI tooling', ar: 'أدوات ذكاء اصطناعي' },
    context: {
      en: 'One person, many hats. I split the work into roles an AI agent can own, so the boring parts run on their own.',
      ar: 'شخص واحد بمهام كثيرة. قسّمت العمل إلى أدوار يتولاها وكلاء أذكياء، لتُنجز المهام الروتينية وحدها.',
    },
    built: {
      en: [
        'Architect, planner, debugger, tester, marketer and content-creator agents.',
        'Covers front-end, back-end, content and scheduling.',
        'Runs 24/7 on the self-hosted Raspberry Pi.',
      ],
      ar: [
        'وكلاء: مهندس معماري، مخطط، مصحح أخطاء، مختبر، مسوّق وصانع محتوى.',
        'يغطي الواجهة الأمامية والخلفية والمحتوى والجدولة.',
        'يعمل 24/7 على خادم Raspberry Pi الذاتي.',
      ],
    },
    outcome: {
      en: 'This portfolio was itself planned and built with an agent pipeline.',
      ar: 'هذا الموقع نفسه خُطط له وبُني بسلسلة من الوكلاء.',
    },
    stack: ['LLMs', 'LangChain', 'Prompt engineering', 'Automation'],
    links: [],
  },
  {
    id: 'school-erp',
    icon: 'calendar',
    accent: '#FF3A66',
    title: { en: 'School Management Software', ar: 'برنامج تسيير المدارس' },
    tagline: {
      en: 'Full management system for a private school, shipped in 2 months.',
      ar: 'نظام تسيير كامل لمدرسة خاصة، أُنجز في شهرين.',
    },
    kind: { en: 'Client software', ar: 'برنامج لعميل' },
    context: {
      en: 'A private school was running payments, timetables and reports on paper and spreadsheets.',
      ar: 'مدرسة خاصة كانت تسيّر المدفوعات والجداول والتقارير بالورق وجداول البيانات.',
    },
    built: {
      en: [
        'Receipts and tuition/payment tracking.',
        'Appointments, events, timetables and planner.',
        'Sales, finances and monthly reports.',
        'Built AI-assisted (Claude + Antigravity) with React, Next.js and Tailwind.',
      ],
      ar: [
        'الوصولات وتتبع الرسوم والمدفوعات.',
        'المواعيد والأحداث والجداول الزمنية والمخطط.',
        'المبيعات والمالية والتقارير الشهرية.',
        'بُني بمساعدة الذكاء الاصطناعي (Claude + Antigravity) باستخدام React وNext.js وTailwind.',
      ],
    },
    outcome: {
      en: 'Delivered a complete system in a 2-month sprint.',
      ar: 'تسليم نظام كامل في سباق مدته شهران.',
    },
    stack: ['React', 'Next.js', 'TypeScript', 'Tailwind', 'AI-assisted'],
    links: [],
  },
];
