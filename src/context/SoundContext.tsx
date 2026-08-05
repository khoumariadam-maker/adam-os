'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { soundSynth } from '@/lib/audio/sound-synth';

interface SoundContextType {
  isMuted: boolean;
  toggleSound: () => void;
  playClick: () => void;
  playWindowOpen: () => void;
  playWindowClose: () => void;
  playBootChime: () => void;
  playError: () => void;
  playSwing: () => void;
  playDownloadFanfare: () => void;
  playShutdown: () => void;
  playSpidermanTheme: () => void;
  stopSpidermanTheme: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState<boolean>(true);

  useEffect(() => {
    setIsMuted(soundSynth.getMuted());
  }, []);

  const toggleSound = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundSynth.setMuted(nextMute);
    if (nextMute) {
      soundSynth.stopSpidermanTheme();
    } else {
      soundSynth.playBootChime();
    }
  };

  return (
    <SoundContext.Provider
      value={{
        isMuted,
        toggleSound,
        playClick: () => soundSynth.playClick(),
        playWindowOpen: () => soundSynth.playWindowOpen(),
        playWindowClose: () => soundSynth.playWindowClose(),
        playBootChime: () => soundSynth.playBootChime(),
        playError: () => soundSynth.playError(),
        playSwing: () => soundSynth.playSwing(),
        playDownloadFanfare: () => soundSynth.playDownloadFanfare(),
        playShutdown: () => soundSynth.playShutdown(),
        playSpidermanTheme: () => soundSynth.playSpidermanTheme(),
        stopSpidermanTheme: () => soundSynth.stopSpidermanTheme(),
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within SoundProvider');
  }
  return context;
};
