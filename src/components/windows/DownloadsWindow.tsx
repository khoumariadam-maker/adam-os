'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

interface DownloadsWindowProps {
  onTriggerTheater?: (file: 'en' | 'ar') => void;
}

// Theater step durations (ms) — spec: 3.2s total, must feel snappy
const STEP_PERK    = 200;  // Step 1: eyes widen
const STEP_WEBLINE = 300;  // Step 2: web line draws
const STEP_SWING   = 600;  // Step 3: swing to file
const STEP_THROW   = 400;  // Step 4: file flies toward camera
const STEP_PROGRESS = 800; // Step 5: progress bar
const STEP_CELEBRATE = 500; // Step 7: celebration frame

type TheaterStep = 'idle' | 'perk' | 'webline' | 'swing' | 'throw' | 'progress' | 'celebrate' | 'done';

export const DownloadsWindow: React.FC<DownloadsWindowProps> = ({ onTriggerTheater }) => {
  const { t } = useLanguage();
  const { playClick, playSwing, playDownloadFanfare } = useSound();
  const mascot = useMascot();

  const [downloadingFile, setDownloadingFile] = useState<'en' | 'ar' | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [theaterStep, setTheaterStep] = useState<TheaterStep>('idle');
  const fileEnRef = useRef<HTMLDivElement>(null);
  const fileArRef = useRef<HTMLDivElement>(null);

  const runTheater = (file: 'en' | 'ar') => {
    playClick();
    setDownloadingFile(file);
    setProgress(0);
    setTheaterStep('perk');

    // Notify mascot context for any legacy subscribers
    if (onTriggerTheater) onTriggerTheater(file);

    // Step 1 — Perk up (eyes widen)
    mascot.setFrame('loading');
    mascot.setSpeechText('Wait — I got this!');

    // Step 2 — Web line draws
    setTimeout(() => {
      setTheaterStep('webline');
      playSwing();
    }, STEP_PERK);

    // Step 3 — Swing to file
    setTimeout(() => {
      setTheaterStep('swing');
      mascot.setFrame('swinging');
    }, STEP_PERK + STEP_WEBLINE);

    // Step 4 — File flies toward camera
    setTimeout(() => {
      setTheaterStep('throw');
      mascot.setSpeechText('Thwip! Incoming!');
    }, STEP_PERK + STEP_WEBLINE + STEP_SWING);

    // Step 5 — Progress bar
    setTimeout(() => {
      setTheaterStep('progress');
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 20;
        });
      }, STEP_PROGRESS / 5);

      // Step 6 — Actual download trigger
      setTimeout(() => {
        const pdfPath = file === 'en'
          ? '/resumes/Khoumari_Adam_CV_EN.pdf'
          : '/resumes/Khoumari_Adam_CV_AR.pdf';
        const fileName = file === 'en'
          ? 'Khoumari_Adam_Resume_EN.pdf'
          : 'Khoumari_Adam_Resume_AR.pdf';
        const a = document.createElement('a');
        a.href = pdfPath;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, STEP_PROGRESS + 100);

    }, STEP_PERK + STEP_WEBLINE + STEP_SWING + STEP_THROW);

    // Step 7 — Celebration
    setTimeout(() => {
      setTheaterStep('celebrate');
      playDownloadFanfare();
      mascot.setFrame('celebrating');
      mascot.setSpeechText("Got it! Check your downloads folder. See you on the other side.");
    }, STEP_PERK + STEP_WEBLINE + STEP_SWING + STEP_THROW + STEP_PROGRESS);

    // Step 8 — Reset to idle
    setTimeout(() => {
      setTheaterStep('done');
      setDownloadingFile(null);
      setProgress(0);
      setTimeout(() => {
        setTheaterStep('idle');
        mascot.setFrame('idle');
      }, STEP_CELEBRATE);
    }, STEP_PERK + STEP_WEBLINE + STEP_SWING + STEP_THROW + STEP_PROGRESS + STEP_CELEBRATE);
  };

  const isRunning = theaterStep !== 'idle';

  return (
    <Window id="downloads">
      <div className="flex flex-col gap-6 font-body">
        <div>
          <h2 className="font-pixel text-xs text-lavender uppercase tracking-wider mb-1">
            {t.downloads.subtitle}
          </h2>
          <p className="text-xs text-textDim">
            Hit download. Pixel Spider handles the rest.
          </p>
        </div>

        {/* File Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* English Resume Card */}
          <div ref={fileEnRef} className="win9x-box-recessed p-4 bg-panel2 flex flex-col justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-panel flex items-center justify-center border border-slate p-1 relative overflow-visible">
                {/* File icon — flies toward camera in step 'throw' */}
                <AnimatePresence>
                  {theaterStep === 'throw' && downloadingFile === 'en' && (
                    <motion.div
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 4, opacity: 0, y: -60 }}
                      exit={{ scale: 1, opacity: 0 }}
                      transition={{ duration: STEP_THROW / 1000, ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                      <img src="/icons/file-pdf.png" alt="" className="w-8 h-8 pixel-art" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <img
                  src="/icons/file-pdf.png"
                  alt="PDF Icon"
                  className="w-8 h-8 pixel-art"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23FF3A66"/><text x="16" y="20" font-family="monospace" font-size="10" fill="%23FFFFFF" text-anchor="middle">PDF</text></svg>`;
                  }}
                />
              </div>
              <div>
                <h3 className="font-pixel text-xs text-text mb-1">
                  {t.downloads.cv_en}
                </h3>
                {/* Web line SVG from Spider → file in step 'webline' */}
                <AnimatePresence>
                  {(theaterStep === 'webline' || theaterStep === 'swing') && downloadingFile === 'en' && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ originX: '100%' }}
                      className="w-24 h-0.5 bg-spidey rounded-full"
                      transition={{ duration: STEP_WEBLINE / 1000 }}
                    />
                  )}
                </AnimatePresence>
                {theaterStep === 'idle' && (
                  <span className="font-mono text-[10px] text-green">✔ Verified Payload</span>
                )}
              </div>
            </div>

            <button
              onClick={() => runTheater('en')}
              disabled={isRunning}
              className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text w-full flex items-center justify-center gap-2 hover:bg-spidey/80 disabled:opacity-50"
              aria-label="Download English resume"
            >
              <span>📥</span>
              <span>{t.downloads.download_btn}</span>
            </button>
          </div>

          {/* Arabic Resume Card */}
          <div ref={fileArRef} className="win9x-box-recessed p-4 bg-panel2 flex flex-col justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-panel flex items-center justify-center border border-slate p-1 relative overflow-visible">
                {/* File icon — flies toward camera in step 'throw' */}
                <AnimatePresence>
                  {theaterStep === 'throw' && downloadingFile === 'ar' && (
                    <motion.div
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 4, opacity: 0, y: -60 }}
                      exit={{ scale: 1, opacity: 0 }}
                      transition={{ duration: STEP_THROW / 1000, ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                      <img src="/icons/file-pdf.png" alt="" className="w-8 h-8 pixel-art" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <img
                  src="/icons/file-pdf.png"
                  alt="PDF Icon"
                  className="w-8 h-8 pixel-art"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23FF3A66"/><text x="16" y="20" font-family="monospace" font-size="10" fill="%23FFFFFF" text-anchor="middle">PDF</text></svg>`;
                  }}
                />
              </div>
              <div>
                <h3 className="font-pixel text-xs text-text mb-1">
                  {t.downloads.cv_ar}
                </h3>
                <AnimatePresence>
                  {(theaterStep === 'webline' || theaterStep === 'swing') && downloadingFile === 'ar' && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ originX: '100%' }}
                      className="w-24 h-0.5 bg-spidey rounded-full"
                      transition={{ duration: STEP_WEBLINE / 1000 }}
                    />
                  )}
                </AnimatePresence>
                {theaterStep === 'idle' && (
                  <span className="font-mono text-[10px] text-green">✔ Verified Payload (RTL)</span>
                )}
              </div>
            </div>

            <button
              onClick={() => runTheater('ar')}
              disabled={isRunning}
              className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text w-full flex items-center justify-center gap-2 hover:bg-spidey/80 disabled:opacity-50"
              aria-label="Download Arabic resume"
            >
              <span>📥</span>
              <span>{t.downloads.download_btn}</span>
            </button>
          </div>
        </div>

        {/* Windows 9x Progress Dialog — visible during step 'progress' */}
        <AnimatePresence>
          {theaterStep === 'progress' && downloadingFile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.12 }}
              className="win9x-box-raised p-4 bg-panel2 border-2 border-slate flex flex-col gap-3"
            >
              <div className="flex justify-between items-center font-pixel text-xs text-text">
                <span>{t.downloads.downloading} Resume_{downloadingFile.toUpperCase()}.pdf...</span>
                <span className="text-green font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-base border border-slate p-1">
                <motion.div
                  className="h-4 bg-green"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              {progress >= 100 && (
                <p className="font-mono text-xs text-green text-center">
                  {t.downloads.complete} ✔
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Celebration banner — step 'celebrate' */}
        <AnimatePresence>
          {theaterStep === 'celebrate' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="win9x-box-raised p-3 bg-spidey/20 border-2 border-green text-center font-pixel text-xs text-green"
            >
              ✔ {t.downloads.complete} — {t.downloads.spider_speech}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Window>
  );
};
