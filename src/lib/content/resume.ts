// Structured résumé content — source of truth: public/resumes/Khoumari_Adam_CV_EN.pdf.
// Contact details live in src/lib/profile.ts (no phone number on purpose).

export interface ResumeEntry {
  period: string;
  title: string;
  org: string;
  bullets: string[];
  tags: string[];
}

export interface ResumeProject {
  name: string;
  summary: string;
  bullets: string[];
  stack: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  period: string;
  details: string;
}

export interface ResumeSkillGroup {
  label: string;
  items: string[];
}

export interface ResumeLanguage {
  name: string;
  level: string;
}

export interface Resume {
  summary: string;
  education: ResumeEducation[];
  experience: ResumeEntry[];
  projects: ResumeProject[];
  skills: ResumeSkillGroup[];
  languages: ResumeLanguage[];
}

export const RESUME: Resume = {
  summary:
    'Embedded systems engineer in his final master year, building tiny computers that do smart things. ' +
    'Started with Arduino and sensors, grew into Raspberry Pi servers, AI agents, and full software systems. ' +
    'Teaches kids robotics, leads a scientific club, and builds agentic AI workflows that automate entire development pipelines.',

  education: [
    {
      degree: "Master's in Embedded Systems",
      school: 'Bouira University',
      period: '2024 — 2027',
      details:
        'Currently in Master 1; Master 2 starts 2026/2027. Focus: embedded systems, IoT, hardware–software integration, AI on edge devices.',
    },
  ],

  experience: [
    {
      period: '2025 — 2026',
      title: 'President',
      org: 'Scientific Club Afaq — Bouira University',
      bullets: [
        'Led the club for two years.',
        'Organized the Race Event Challenge: a 4-day program teaching participants with zero electronics background, then guiding them to build smart robotic cars controlled by mobile apps via ESP32.',
        'Designed the curriculum, ran the workshops and debugged 30+ projects in real time.',
        'Shipped the final robotics soccer (Rocket League) challenge.',
      ],
      tags: ['Leadership', 'ESP32', 'Workshops', 'Robotics'],
    },
    {
      period: '2024 — 2025',
      title: 'Arduino & Robotics Instructor',
      org: 'CLS Bouira',
      bullets: [
        'Taught kids aged 10–16 the basics of electronics, Arduino programming and robot construction.',
        'Designed the curriculum from scratch — from “what is an LED” up to autonomous line-following cars.',
        'Focused on teaching students how to think like builders, not just the tech.',
      ],
      tags: ['Teaching', 'Arduino', 'Curriculum'],
    },
    {
      period: '2024 — Present',
      title: 'AI Vibe Coder & Agentic AI Builder',
      org: 'Independent',
      bullets: [
        'Builds agentic workflows and agentic AI systems for real use.',
        'Shipped a multi-agent dev workflow — architect, planner, debugger, tester, marketer and content creator working as a single automated team.',
        'Handles front-end, back-end, content, scheduling and operations; runs 24/7 on a self-hosted Raspberry Pi server.',
      ],
      tags: ['LLM', 'Agents', 'Automation', 'Raspberry Pi'],
    },
    {
      period: '2025',
      title: 'Full-Stack Builder',
      org: 'Independent',
      bullets: [
        'Built a complete school management software in 2 months with Claude + Antigravity — receipts, payment tracking, appointments, event scheduling, sales, finances, reports, timetables and planners.',
        'Shipped client web apps with React, Next.js and Tailwind.',
      ],
      tags: ['Full-Stack', 'AI-Assisted', 'Product'],
    },
  ],

  projects: [
    {
      name: 'Smart Irrigation',
      summary: 'AI-predictive plant monitoring system.',
      bullets: [
        'ESP32 + DHT22 + soil moisture sensors stream data to Firebase.',
        'Web app shows real-time sensor data.',
        'ML model predicts plant type from sensor readings.',
      ],
      stack: ['ESP32', 'DHT22', 'Firebase', 'ML', 'Web app'],
    },
    {
      name: 'Race Challenge',
      summary: '4-day workshop + build: smart robotic cars controlled by mobile apps.',
      bullets: [
        'Line-following (optical) mode and Rocket League-style soccer mode.',
        '30+ participants taken from zero to a working bot.',
      ],
      stack: ['ESP32', 'Bluetooth', 'Motor drivers', 'Mobile app'],
    },
    {
      name: 'Agentic Dev Team',
      summary: 'Multi-agent development workflow.',
      bullets: [
        'Architect, planner, debugger, tester, marketer and content-creator agents.',
        'Automates front-end, back-end, content and scheduling.',
        'Runs 24/7 on a Raspberry Pi.',
      ],
      stack: ['LLM', 'LangChain', 'Automation', 'Raspberry Pi'],
    },
    {
      name: 'School Management Software',
      summary: 'Full school management software built in a 2-month sprint with Claude + Antigravity.',
      bullets: [
        'Receipts, payments, appointments, events, sales, finances, reports, timetables and planner.',
      ],
      stack: ['React', 'Next.js', 'Tailwind', 'AI-assisted'],
    },
    {
      name: 'Raspberry Pi Self-Host',
      summary: 'Self-hosted Linux server on Raspberry Pi — an SSH-accessible VPS replacement.',
      bullets: [
        'Runs AI agents 24/7 without subscription costs.',
        'Hosts side projects, automates cron jobs and serves as a personal cloud.',
      ],
      stack: ['Linux', 'SSH', 'Docker', 'Cron'],
    },
  ],

  skills: [
    { label: 'Embedded & Hardware', items: ['Embedded C', 'Arduino', 'ESP32', 'Raspberry Pi'] },
    { label: 'Cloud & Systems', items: ['Firebase', 'Linux / SSH', 'Docker', 'Cron'] },
    { label: 'Software', items: ['React / Next.js', 'TypeScript', 'Python', 'Tailwind'] },
    { label: 'AI', items: ['Agentic AI', 'LangChain', 'Prompt Engineering', 'LLM automation'] },
  ],

  languages: [
    { name: 'Arabic', level: 'Native' },
    { name: 'English', level: 'Fluent' },
    { name: 'French', level: 'Working proficiency' },
  ],
};
