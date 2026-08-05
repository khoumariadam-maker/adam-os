'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';

type FileItem = {
  name: string;
  size: string;
  type: 'doc' | 'code' | 'image' | 'pdf';
  content: string;
  path: string;
};

const FILE_TREE: Record<string, FileItem[]> = {
  'C:\\home\\adam\\documents': [
    {
      name: 'Bio_Summary.txt',
      size: '2.4 KB',
      type: 'doc',
      path: 'C:\\home\\adam\\documents\\Bio_Summary.txt',
      content: 'Khoumari Adam — Embedded Systems Engineer & AI Vibe Coder.\nGraduating Master 2 in 2027 from Bouira University.\nFormer President of Scientific Club Afaq (2025-2026).\nRobotics Instructor at CLS Bouira.',
    },
    {
      name: 'Resume_EN.pdf',
      size: '185 KB',
      type: 'pdf',
      path: 'C:\\home\\adam\\documents\\Resume_EN.pdf',
      content: 'Verified PDF Payload. Embedded systems, ESP32, Machine Learning soil classification, autonomous robotics bootcamps, Raspberry Pi servers.',
    },
  ],
  'C:\\home\\adam\\projects': [
    {
      name: 'Smart_Irrigation.cpp',
      size: '8.1 KB',
      type: 'code',
      path: 'C:\\home\\adam\\projects\\Smart_Irrigation.cpp',
      content: '// ESP32 Smart Irrigation System\n#include <WiFi.h>\n#include <FirebaseESP32.h>\n\nvoid setup() {\n  pinMode(SOIL_SENSOR_PIN, INPUT);\n  // ML Soil Moisture Classifier\n}',
    },
    {
      name: 'RocketLeague_Robotics.cpp',
      size: '12.4 KB',
      type: 'code',
      path: 'C:\\home\\adam\\projects\\RocketLeague_Robotics.cpp',
      content: '// ESP32 Autonomous Line Following & PWM Motor Driver\nvoid loop() {\n  readPIDSensors();\n  adjustMotorPWM();\n}',
    },
  ],
  'C:\\home\\adam\\media': [
    {
      name: 'Adam_Portrait.png',
      size: '559 KB',
      type: 'image',
      path: 'C:\\home\\adam\\media\\Adam_Portrait.png',
      content: '/mascot/adam-portrait.png',
    },
  ],
};

export const ExplorerWindow: React.FC = () => {
  const { playClick } = useSound();
  const [selectedDir, setSelectedDir] = useState<string>('C:\\home\\adam\\documents');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(FILE_TREE['C:\\home\\adam\\documents'][0]);

  const handleSelectDir = (dir: string) => {
    playClick();
    setSelectedDir(dir);
    setSelectedFile(FILE_TREE[dir][0] || null);
  };

  const handleSelectFile = (file: FileItem) => {
    playClick();
    setSelectedFile(file);
  };

  return (
    <Window id="explorer">
      <div className="flex flex-col h-full gap-3 font-body text-textDim select-none">
        {/* Address Bar */}
        <div className="win9x-box-recessed p-2 bg-panel2 flex items-center gap-2 border border-slate font-mono text-xs">
          <span className="text-yellow">LOCATION:</span>
          <span className="text-green font-bold">{selectedDir}</span>
        </div>

        {/* Explorer Split View */}
        <div className="flex flex-1 gap-3 min-h-[280px]">
          {/* Left Directory Tree */}
          <div className="w-48 win9x-box-recessed p-2 bg-panel2 space-y-1 font-pixel text-[11px] border border-slate">
            <div className="text-lavender mb-2 uppercase tracking-wider text-[9px]">DIRECTORIES</div>
            {Object.keys(FILE_TREE).map((dir) => {
              const isSelected = selectedDir === dir;
              const folderName = dir.split('\\').pop();
              return (
                <button
                  key={dir}
                  onClick={() => handleSelectDir(dir)}
                  className={`w-full text-left px-2 py-1 flex items-center gap-1.5 ${
                    isSelected ? 'bg-spidey text-text font-bold' : 'hover:bg-panel text-textDim'
                  }`}
                >
                  <span>📁</span>
                  <span className="truncate">{folderName}</span>
                </button>
              );
            })}
          </div>

          {/* Right File List & Preview Pane */}
          <div className="flex-1 flex flex-col gap-3">
            {/* File Items Grid */}
            <div className="win9x-box-recessed p-2 bg-panel2 grid grid-cols-2 gap-2 border border-slate">
              {FILE_TREE[selectedDir]?.map((file) => {
                const isSelected = selectedFile?.name === file.name;
                return (
                  <button
                    key={file.name}
                    onClick={() => handleSelectFile(file)}
                    className={`p-2 border flex items-center gap-2 text-left font-mono text-xs ${
                      isSelected ? 'border-spidey bg-spidey/20 text-text' : 'border-slate/40 hover:bg-panel text-textDim'
                    }`}
                  >
                    <span>{file.type === 'image' ? '🖼' : file.type === 'code' ? '⚙' : file.type === 'pdf' ? '📕' : '📄'}</span>
                    <div className="overflow-hidden">
                      <div className="font-bold truncate">{file.name}</div>
                      <div className="text-[10px] text-lavender">{file.size}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Preview Pane */}
            {selectedFile && (
              <div className="win9x-box-recessed p-3 bg-base border border-spidey flex-1 overflow-y-auto font-mono text-xs">
                <div className="text-yellow font-pixel text-[10px] mb-2 border-b border-slate/30 pb-1">
                  PREVIEW: {selectedFile.name}
                </div>
                {selectedFile.type === 'image' ? (
                  <div className="flex justify-center p-2">
                    <img src={selectedFile.content} alt="" className="w-28 h-28 object-contain pixel-art border border-slate" />
                  </div>
                ) : (
                  <pre className="text-green leading-relaxed whitespace-pre-wrap">{selectedFile.content}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Window>
  );
};
