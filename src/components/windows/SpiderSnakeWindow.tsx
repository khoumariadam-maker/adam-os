'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const GRID_SIZE = 16;
const INITIAL_SNAKE: Position[] = [
  { x: 8, y: 8 },
  { x: 8, y: 9 },
  { x: 8, y: 10 },
];

export const SpiderSnakeWindow: React.FC = () => {
  const { playClick, playError, playDownloadFanfare } = useSound();
  const mascot = useMascot();

  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [dir, setDir] = useState<Direction>('UP');
  const [food, setFood] = useState<Position>({ x: 4, y: 4 });
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('adam_os_snake_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const spawnFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const collides = currentSnake.some((s) => s.x === newFood.x && s.y === newFood.y);
      if (!collides) break;
    }
    return newFood;
  }, []);

  const handleStart = () => {
    playClick();
    setSnake(INITIAL_SNAKE);
    setDir('UP');
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(true);
    setFood(spawnFood(INITIAL_SNAKE));
    mascot.setFrame('typing');
    mascot.setSpeechText('Guide Pixel Spider! Catch the web bugs!');
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isPlaying || isGameOver) return;
      if (['ArrowUp', 'KeyW'].includes(e.code) && dir !== 'DOWN') {
        e.preventDefault();
        setDir('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code) && dir !== 'UP') {
        e.preventDefault();
        setDir('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code) && dir !== 'RIGHT') {
        e.preventDefault();
        setDir('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code) && dir !== 'LEFT') {
        e.preventDefault();
        setDir('RIGHT');
      }
    },
    [dir, isPlaying, isGameOver]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Main game tick (130ms speed)
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    gameLoopRef.current = setInterval(() => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };

        switch (dir) {
          case 'UP':
            head.y -= 1;
            break;
          case 'DOWN':
            head.y += 1;
            break;
          case 'LEFT':
            head.x -= 1;
            break;
          case 'RIGHT':
            head.x += 1;
            break;
        }

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          playError();
          setIsGameOver(true);
          setIsPlaying(false);
          mascot.setFrame('sleeping');
          mascot.setSpeechText('Ouch! Hit the wall. Press START to retry!');
          return prevSnake;
        }

        // Self collision
        if (prevSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
          playError();
          setIsGameOver(true);
          setIsPlaying(false);
          mascot.setFrame('sleeping');
          mascot.setSpeechText('Caught in your own web! Game Over.');
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Eat food
        if (head.x === food.x && head.y === food.y) {
          playClick();
          const newScore = score + 10;
          setScore(newScore);

          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('adam_os_snake_highscore', String(newScore));
            playDownloadFanfare();
            mascot.setFrame('celebrating');
            mascot.setSpeechText('NEW HIGH SCORE! Legend status!');
          }

          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 130);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, isGameOver, dir, food, score, highScore, spawnFood]);

  return (
    <Window id="snake">
      <div className="flex flex-col items-center gap-3 font-pixel select-none">
        {/* Game Stats Header */}
        <div className="w-full flex justify-between items-center text-xs bg-panel2 p-2 border border-slate">
          <span className="text-green">SCORE: {score}</span>
          <span className="text-yellow">HIGH: {highScore}</span>
        </div>

        {/* 16x16 Grid Playfield */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(16, minmax(0, 1fr))',
          }}
          className="relative w-64 h-64 bg-[#0B0B10] border-2 border-[#212CF4] p-0.5"
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
            const x = idx % GRID_SIZE;
            const y = Math.floor(idx / GRID_SIZE);

            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = snake.slice(1).some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;

            return (
              <div
                key={idx}
                className={`w-full h-full border-[0.5px] border-slate/10 ${
                  isHead
                    ? 'bg-yellow shadow-[0_0_4px_#FFE55C]'
                    : isBody
                    ? 'bg-spidey'
                    : isFood
                    ? 'bg-green animate-pulse rounded-full'
                    : ''
                }`}
              />
            );
          })}

          {/* Game Over Overlay */}
          {isGameOver && (
            <div className="absolute inset-0 bg-[#0B0B10]/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <span className="text-red text-sm">GAME OVER</span>
              <span className="text-xs text-lavender font-mono">FINAL SCORE: {score}</span>
              <button
                onClick={handleStart}
                className="win9x-button win9x-button-spidey px-3 py-1 text-xs mt-2"
              >
                RETRY [START]
              </button>
            </div>
          )}
        </div>

        {/* Controls / Start Bar */}
        <div className="w-full flex justify-between items-center gap-2 font-mono text-[10px]">
          <span className="text-lavender hidden md:block">CONTROLS: ARROWS / WASD</span>
          {!isPlaying && !isGameOver && (
            <button
              onClick={handleStart}
              className="win9x-button win9x-button-spidey px-4 py-1.5 font-pixel text-xs text-text"
            >
              START GAME
            </button>
          )}
        </div>

        {/* Mobile D-Pad touch controls */}
        <div className="flex flex-col items-center gap-1 md:hidden mt-1">
          <button
            onPointerDown={(e) => { e.preventDefault(); if (isPlaying && dir !== 'DOWN') setDir('UP'); }}
            className="win9x-button w-12 h-12 font-pixel text-lg flex items-center justify-center"
            aria-label="Move up"
          >▲</button>
          <div className="flex gap-1">
            <button
              onPointerDown={(e) => { e.preventDefault(); if (isPlaying && dir !== 'RIGHT') setDir('LEFT'); }}
              className="win9x-button w-12 h-12 font-pixel text-lg flex items-center justify-center"
              aria-label="Move left"
            >◀</button>
            <button
              onPointerDown={(e) => { e.preventDefault(); if (isPlaying && dir !== 'UP') setDir('DOWN'); }}
              className="win9x-button w-12 h-12 font-pixel text-lg flex items-center justify-center"
              aria-label="Move down"
            >▼</button>
            <button
              onPointerDown={(e) => { e.preventDefault(); if (isPlaying && dir !== 'LEFT') setDir('RIGHT'); }}
              className="win9x-button w-12 h-12 font-pixel text-lg flex items-center justify-center"
              aria-label="Move right"
            >▶</button>
          </div>
        </div>
      </div>
    </Window>
  );
};
