'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Ignore keys used for navigation/assistive tech so keyboard users can still Tab to the link.
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape']);

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (IGNORED_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      router.push('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div
      className="fixed inset-0 overflow-y-auto flex items-center justify-center px-4 py-8 font-mono text-white"
      style={{ backgroundColor: '#0000AA', userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <main className="w-full max-w-2xl text-[14px] sm:text-[16px] leading-relaxed">
        <div className="flex justify-center mb-6">
          <h1 className="px-2 bg-[#AAAAAA] text-[#0000AA] font-bold" style={{ userSelect: 'text' }}>
            ADAM OS
          </h1>
        </div>
        <p className="mb-6" style={{ userSelect: 'text' }}>
          A fatal exception 404 has occurred at 0028:C0FFEE in VXD ADAM_OS(01) + 00000404. The
          current application will be terminated.
        </p>
        <p className="mb-6" style={{ userSelect: 'text' }}>
          The page you requested does not exist.
        </p>
        <ul className="mb-8 space-y-2">
          <li>
            <Link
              href="/"
              autoFocus
              className="hover:bg-white hover:text-[#0000AA] focus:bg-white focus:text-[#0000AA] focus:outline-none"
            >
              * Press any key or click here to return to Adam OS
            </Link>
          </li>
          <li style={{ userSelect: 'text' }}>
            * Press CTRL+ALT+DEL again to restart your computer. You will lose any unsaved
            information in all applications.
          </li>
        </ul>
        <p className="text-center" style={{ userSelect: 'text' }}>
          Press any key to continue <span className="animate-pulse">_</span>
        </p>
      </main>
    </div>
  );
}
