'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';

export const JukeboxWindow: React.FC = () => {
  const { playSpidermanTheme, playBootChime, playDownloadFanfare, playSwing, isMuted, toggleSound } = useSound();
  const [activeTrack, setActiveTrack] = useState<string | null>(null);

  const tracks = [
    {
      id: 'spidey94',
      title: 'Spider-Man 1994 Animated Series Theme (8-Bit)',
      duration: '0:03',
      action: () => playSpidermanTheme(),
    },
    {
      id: 'fanfare',
      title: 'CV Download Victory Fanfare',
      duration: '0:01',
      action: () => playDownloadFanfare(),
    },
    {
      id: 'boot',
      title: 'Adam OS Phoenix Chime (Ascending C5->E5)',
      duration: '0:01',
      action: () => playBootChime(),
    },
    {
      id: 'web',
      title: 'Web Slinger Thwip Sound Effect',
      duration: '0:01',
      action: () => playSwing(),
    },
  ];

  const handlePlay = (track: typeof tracks[0]) => {
    setActiveTrack(track.id);
    track.action();
    setTimeout(() => setActiveTrack(null), 3000);
  };

  return (
    <Window id="jukebox">
      <div className="flex flex-col gap-4 font-body text-textDim">
        <div className="flex items-center justify-between border-b border-slate pb-2">
          <span className="font-pixel text-xs text-lavender uppercase tracking-wider">
            8-Bit Retro Audio Jukebox v1.0
          </span>
          <button
            onClick={toggleSound}
            className="win9x-button px-2 py-0.5 font-pixel text-[10px] text-yellow"
          >
            {isMuted ? '🔇 Muted' : '🔊 Sound Enabled'}
          </button>
        </div>

        {/* Cassette Deck Display */}
        <div className="win9x-box-recessed p-4 bg-base text-center space-y-2 border-2 border-spidey">
          <div className="font-pixel text-xs text-green animate-pulse">
            {activeTrack ? `▶ PLAYING: ${tracks.find(t => t.id === activeTrack)?.title}` : '|| STANDBY — SELECT TRACK BELOW'}
          </div>
          <div className="flex justify-center gap-1 font-mono text-[10px] text-lavender">
            <span>[ STEREO ]</span>
            <span>[ 8-BIT OSCILLATOR ]</span>
            <span>[ ZERO AUDIO FILES ]</span>
          </div>
        </div>

        {/* Track List */}
        <div className="space-y-2">
          {tracks.map((track) => {
            const isPlaying = activeTrack === track.id;
            return (
              <div
                key={track.id}
                onClick={() => handlePlay(track)}
                className={`win9x-box-recessed p-3 bg-panel2 flex items-center justify-between cursor-pointer hover:border-spidey transition-colors ${
                  isPlaying ? 'border-spidey bg-spidey/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-pixel text-xs text-yellow">{isPlaying ? '▶' : '♫'}</span>
                  <span className="font-pixel text-xs text-text">{track.title}</span>
                </div>
                <span className="font-mono text-[10px] text-lavender">{track.duration}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Window>
  );
};
