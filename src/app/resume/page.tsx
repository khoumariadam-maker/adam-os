import type { Metadata } from 'next';
import Link from 'next/link';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';
import { RESUME } from '@/lib/content/resume';

export const metadata: Metadata = {
  title: `Résumé — ${PROFILE.name} · ${PROFILE.role}`,
  description: `One-page résumé of ${PROFILE.name}, ${PROFILE.role} based in ${PROFILE.location}. Embedded systems (ESP32, Arduino, Raspberry Pi), robotics teaching and agentic AI workflows.`,
  alternates: { canonical: '/resume/' },
};

// Global CSS disables text selection and page scrolling for the OS desktop;
// this page re-enables both locally and adds print styles.
const PAGE_CSS = `
.resume-root, .resume-root * { user-select: text; -webkit-user-select: text; }
.resume-root a:focus-visible { outline: 2px solid #C3C6ED; outline-offset: 2px; }
@media print {
  html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
  .resume-root { position: static !important; overflow: visible !important; height: auto !important; background: #fff !important; color: #000 !important; }
  .resume-root * { color: #000 !important; background: transparent !important; border-color: #999 !important; box-shadow: none !important; }
  .resume-root .no-print { display: none !important; }
  .resume-root section, .resume-root article { break-inside: avoid; }
  .resume-root main { padding: 0 !important; max-width: none !important; }
  @page { margin: 14mm; }
}
`;

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-pixel text-[11px] leading-relaxed tracking-wider uppercase text-lavender border-b border-slate/30 pb-2 mb-4"
    >
      {children}
    </h2>
  );
}

function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1 mt-2" aria-label="Tags">
      {items.map((t) => (
        <li
          key={t}
          className="font-mono text-[11px] px-2 py-[2px] border border-slate/40 text-lavender bg-panel2"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function ResumePage() {
  const contactLink = 'underline decoration-slate/50 underline-offset-2 hover:text-text hover:decoration-lavender';

  return (
    <div className="resume-root fixed inset-0 overflow-y-auto bg-base text-textDim font-body">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 text-[15px] sm:text-[16px] leading-relaxed">
        <nav className="no-print mb-6">
          <Link href="/" className={`${contactLink} font-mono text-[13px] text-lavender`}>
            ← Open Adam OS
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-text tracking-tight">{PROFILE.name}</h1>
          <p className="mt-1 text-[17px] text-text">{PROFILE.role}</p>
          <ul className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1 text-[14px]">
            <li>{PROFILE.location}</li>
            <li>
              <a className={contactLink} href={`mailto:${PROFILE.email}`}>
                {PROFILE.email}
              </a>
            </li>
            {PROFILE.github && (
              <li>
                <a className={contactLink} href={PROFILE.github} target="_blank" rel="noopener noreferrer">
                  {PROFILE.github.replace(/^https?:\/\//, '')}
                </a>
              </li>
            )}
            {PROFILE.linkedin && (
              <li>
                <a className={contactLink} href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </li>
            )}
          </ul>

          <div className="no-print mt-6 flex flex-wrap gap-2">
            <a
              href={asset(PROFILE.resumes.en.path)}
              download={PROFILE.resumes.en.download}
              className="win9x-button-spidey px-4 py-2 text-[14px] font-semibold"
            >
              Download PDF (EN)
            </a>
            <a
              href={asset(PROFILE.resumes.ar.path)}
              download={PROFILE.resumes.ar.download}
              lang="ar"
              dir="rtl"
              className="win9x-button px-4 py-2 text-[14px] font-semibold"
            >
              تحميل (AR)
            </a>
          </div>
        </header>

        <section aria-labelledby="summary" className="mb-8">
          <SectionHeading id="summary">Summary</SectionHeading>
          <p>{RESUME.summary}</p>
        </section>

        <section aria-labelledby="experience" className="mb-8">
          <SectionHeading id="experience">Experience &amp; Leadership</SectionHeading>
          <div className="flex flex-col gap-6">
            {RESUME.experience.map((e) => (
              <article key={`${e.title}-${e.period}`}>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-x-4">
                  <h3 className="text-text font-semibold text-[16px] sm:text-[17px]">
                    {e.title} <span className="font-normal text-lavender">· {e.org}</span>
                  </h3>
                  <p className="font-mono text-[12px] text-slate whitespace-nowrap">{e.period}</p>
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {e.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <Tags items={e.tags} />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="projects" className="mb-8">
          <SectionHeading id="projects">Projects</SectionHeading>
          <div className="flex flex-col gap-6">
            {RESUME.projects.map((p) => (
              <article key={p.name}>
                <h3 className="text-text font-semibold text-[16px] sm:text-[17px]">{p.name}</h3>
                <p className="text-textDim">{p.summary}</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {p.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <Tags items={p.stack} />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="skills" className="mb-8">
          <SectionHeading id="skills">Skills</SectionHeading>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RESUME.skills.map((g) => (
              <div key={g.label}>
                <dt className="text-text font-semibold">{g.label}</dt>
                <dd>{g.items.join(' · ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="education" className="mb-8">
          <SectionHeading id="education">Education</SectionHeading>
          {RESUME.education.map((ed) => (
            <article key={ed.degree}>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-x-4">
                <h3 className="text-text font-semibold text-[16px] sm:text-[17px]">
                  {ed.degree} <span className="font-normal text-lavender">· {ed.school}</span>
                </h3>
                <p className="font-mono text-[12px] text-slate whitespace-nowrap">{ed.period}</p>
              </div>
              <p className="mt-1">{ed.details}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="languages" className="mb-8">
          <SectionHeading id="languages">Languages</SectionHeading>
          <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-1">
            {RESUME.languages.map((l) => (
              <li key={l.name}>
                <span className="text-text font-semibold">{l.name}</span> — {l.level}
              </li>
            ))}
          </ul>
        </section>

        <footer className="no-print border-t border-slate/30 pt-4 mt-10 flex flex-wrap justify-between gap-2 font-mono text-[12px] text-slate">
          <span>
            © {PROFILE.name}
          </span>
          <Link href="/" className={contactLink}>
            ← Back to Adam OS
          </Link>
        </footer>
      </main>
    </div>
  );
}
