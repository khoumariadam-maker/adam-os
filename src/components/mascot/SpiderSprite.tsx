'use client';

import React from 'react';
import { asset } from '@/lib/asset';
import type { AnimMeta, AnimName } from './anims';

interface SpiderSpriteProps {
  anim: AnimName;
  meta: AnimMeta;
  size: number;
  flip?: boolean;
  paused?: boolean;
  // Bumping this restarts a one-shot animation (e.g. a second hop).
  playId?: number;
  onEnd?: () => void;
  // Strip failed to load: show the single still image instead.
  fallbackSrc?: string;
}

// One CSS keyframe per strip length; shared by every animation with that many frames.
const keyframeName = (frames: number, size: number, loop: boolean) => `msp-${frames}-${size}-${loop ? 'l' : 'o'}`;

export const spriteKeyframes = (lengths: Array<{ frames: number; loop: boolean }>, size: number) =>
  lengths
    .filter((l) => l.frames > 1)
    .map(({ frames, loop }) => {
      // Loops step through all frames and wrap; one-shots land on (and hold) the last frame.
      const end = loop ? frames * size : (frames - 1) * size;
      return `@keyframes ${keyframeName(frames, size, loop)}{from{background-position:0 0}to{background-position:-${end}px 0}}`;
    })
    .join('');

// Plays one horizontal strip with CSS steps(). The art is 256px per frame and is shown at
// exactly 128px (desktop) or 64px (phone): clean 2:1 / 4:1 downscales, native on hi-DPI screens.
export const SpiderSprite: React.FC<SpiderSpriteProps> = ({ anim, meta, size, flip, paused, playId = 0, onEnd, fallbackSrc }) => {
  const { frames, fps, loop } = meta;
  const animated = frames > 1 && !paused;
  const style: React.CSSProperties = fallbackSrc
    ? { backgroundImage: `url(${fallbackSrc})`, backgroundSize: '100% 100%' }
    : {
        backgroundImage: `url(${asset(`/mascot/v2/${anim}.png`)})`,
        backgroundSize: `${frames * size}px ${size}px`,
        backgroundPosition: '0 0',
        animation: animated
          ? `${keyframeName(frames, size, loop)} ${frames / fps}s ${loop ? `steps(${frames})` : `steps(${frames - 1}, jump-none)`} ${
              loop ? 'infinite' : '1 forwards'
            }`
          : 'none',
      };

  return (
    <div
      key={`${anim}-${playId}`}
      aria-hidden="true"
      onAnimationEnd={onEnd}
      style={{
        ...style,
        width: size,
        height: size,
        backgroundRepeat: 'no-repeat',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  );
};
