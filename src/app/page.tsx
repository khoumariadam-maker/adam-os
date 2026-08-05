'use client';

import React, { useState, useEffect } from 'react';
import { LanguageProvider } from '@/context/LanguageContext';
import { SoundProvider } from '@/context/SoundContext';
import { WindowManagerProvider } from '@/context/WindowManagerContext';
import { MascotProvider } from '@/context/MascotContext';
import { BootSequence } from '@/components/BootSequence';
import { Desktop } from '@/components/Desktop';
import { CustomCursor } from '@/components/CustomCursor';

export default function Home() {
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <LanguageProvider>
      <SoundProvider>
        <WindowManagerProvider>
          <MascotProvider>
            <main className="relative w-screen h-screen overflow-hidden bg-base">
              {/* Custom 8-bit Pixel Cursor & Cobalt Trail Physics */}
              <CustomCursor />

              {/* Desktop Workspace is always mounted */}
              <Desktop onReboot={() => setIsBooting(true)} />

              {/* Boot Sequence Overlay when booting */}
              {isBooting && (
                <BootSequence onComplete={() => setIsBooting(false)} />
              )}
            </main>
          </MascotProvider>
        </WindowManagerProvider>
      </SoundProvider>
    </LanguageProvider>
  );
}
