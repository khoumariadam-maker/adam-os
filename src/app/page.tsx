'use client';

import React, { useState, useEffect } from 'react';
import { LanguageProvider } from '@/context/LanguageContext';
import { SoundProvider } from '@/context/SoundContext';
import { WindowManagerProvider } from '@/context/WindowManagerContext';
import { MascotProvider } from '@/context/MascotContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { BootSequence } from '@/components/BootSequence';
import { Desktop } from '@/components/Desktop';
import { CustomCursor } from '@/components/CustomCursor';
import { SoundToast } from '@/components/SoundToast';
import { Screensaver } from '@/components/Screensaver';
import { readStorage, writeStorage } from '@/lib/storage';

const BOOTED_KEY = 'adam_os_booted';

const Shell: React.FC<{ initialBoot: boolean }> = ({ initialBoot }) => {
  const [isBooting, setIsBooting] = useState<boolean>(initialBoot);
  const { settings } = useSettings();

  const finishBoot = () => {
    writeStorage(BOOTED_KEY, '1');
    setIsBooting(false);
  };

  return (
    <main className="os-shell fixed inset-0 h-[100dvh] overflow-hidden bg-base">
      {settings.customCursor && <CustomCursor />}
      <Desktop onReboot={() => setIsBooting(true)} />
      {isBooting && <BootSequence onComplete={finishBoot} />}
      {!isBooting && <SoundToast />}
      <Screensaver enabled={settings.screensaver && !isBooting} />
    </main>
  );
};

export default function Home() {
  const [initialBoot, setInitialBoot] = useState<boolean | null>(null);

  // Returning visitors skip straight to the desktop; `?boot` replays the sequence.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInitialBoot(params.has('boot') || (!params.has('skipboot') && readStorage(BOOTED_KEY) === null));
  }, []);

  if (initialBoot === null) return <div className="fixed inset-0 bg-base" />;

  return (
    <LanguageProvider>
      <SoundProvider>
        <SettingsProvider>
          <WindowManagerProvider>
            <MascotProvider>
              <Shell initialBoot={initialBoot} />
            </MascotProvider>
          </WindowManagerProvider>
        </SettingsProvider>
      </SoundProvider>
    </LanguageProvider>
  );
}
