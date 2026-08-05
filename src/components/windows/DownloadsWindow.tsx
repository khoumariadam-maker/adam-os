'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

interface DownloadsWindowProps {
  onTriggerTheater?: (file: 'en' | 'ar') => void;
}

export const DownloadsWindow: React.FC<DownloadsWindowProps> = ({ onTriggerTheater }) => {
  const { t } = useLanguage();
  const { playClick, playDownloadFanfare } = useSound();
  const [downloadingFile, setDownloadingFile] = useState<'en' | 'ar' | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const handleDownload = (file: 'en' | 'ar') => {
    playClick();
    if (onTriggerTheater) {
      onTriggerTheater(file);
    }

    setDownloadingFile(file);
    setProgress(0);

    // Progress bar fill sequence (0.8s)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          playDownloadFanfare();

          // Native browser file download trigger for real PDF
          setTimeout(() => {
            const pdfPath = file === 'en' ? '/resumes/Khoumari_Adam_CV_EN.pdf' : '/resumes/Khoumari_Adam_CV_AR.pdf';
            const fileName = file === 'en' ? 'Khoumari_Adam_Resume_EN.pdf' : 'Khoumari_Adam_Resume_AR.pdf';
            const a = document.createElement('a');
            a.href = pdfPath;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setDownloadingFile(null);
          }, 600);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  return (
    <Window id="downloads">
      <div className="flex flex-col gap-6 font-body">
        <div>
          <h2 className="font-pixel text-xs text-lavender uppercase tracking-wider mb-1">
            {t.downloads.subtitle}
          </h2>
          <p className="text-xs text-textDim">
            Click download to trigger the transfer protocol.
          </p>
        </div>

        {/* File Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* English Resume Card */}
          <div className="win9x-box-recessed p-4 bg-panel2 flex flex-col justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-panel flex items-center justify-center border border-slate p-1">
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
                <span className="font-mono text-[10px] text-green">✔ Verified Payload</span>
              </div>
            </div>

            <button
              onClick={() => handleDownload('en')}
              disabled={downloadingFile !== null}
              className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text w-full flex items-center justify-center gap-2 hover:bg-spidey/80 disabled:opacity-50"
            >
              <span>📥</span>
              <span>{t.downloads.download_btn}</span>
            </button>
          </div>

          {/* Arabic Resume Card */}
          <div className="win9x-box-recessed p-4 bg-panel2 flex flex-col justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-panel flex items-center justify-center border border-slate p-1">
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
                <span className="font-mono text-[10px] text-green">✔ Verified Payload (RTL)</span>
              </div>
            </div>

            <button
              onClick={() => handleDownload('ar')}
              disabled={downloadingFile !== null}
              className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text w-full flex items-center justify-center gap-2 hover:bg-spidey/80 disabled:opacity-50"
            >
              <span>📥</span>
              <span>{t.downloads.download_btn}</span>
            </button>
          </div>
        </div>

        {/* Windows 9x Progress Dialog Modal */}
        {downloadingFile && (
          <div className="win9x-box-raised p-4 bg-panel2 border-2 border-slate flex flex-col gap-3">
            <div className="flex justify-between items-center font-pixel text-xs text-text">
              <span>{t.downloads.downloading} Resume_{downloadingFile.toUpperCase()}.pdf...</span>
              <span className="text-green font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-base border border-slate p-1">
              <div
                className="h-4 bg-green transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Window>
  );
};
