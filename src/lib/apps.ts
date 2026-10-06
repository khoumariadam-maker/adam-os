// Registry of every app window in Adam OS. The window manager, desktop, start menu,
// taskbar and command palette are all built from this list.

import type { IconName } from './pixel-icons';

export type WindowId =
  | 'about'
  | 'projects'
  | 'skills'
  | 'lab'
  | 'terminal'
  | 'downloads'
  | 'contact'
  | 'github'
  | 'explorer'
  | 'jukebox'
  | 'snake'
  | 'minesweeper'
  | 'paint'
  | 'controlpanel';

export type AppGroup = 'portfolio' | 'tools' | 'games';

export interface AppDef {
  id: WindowId;
  title: string;
  icon: string;
  // Small pixel icon used in menus, the taskbar and the command palette.
  glyph: IconName;
  group: AppGroup;
  size: { width: number; height: number };
  keywords: string;
  onDesktop: boolean;
}

export const APPS: AppDef[] = [
  { id: 'about', title: 'About.exe', icon: '/icons/app-about.png', glyph: 'about', group: 'portfolio', size: { width: 620, height: 480 }, keywords: 'bio story me who adam', onDesktop: true },
  { id: 'projects', title: 'Projects.exe', icon: '/icons/app-projects.png', glyph: 'projects', group: 'portfolio', size: { width: 760, height: 520 }, keywords: 'work builds portfolio case study', onDesktop: true },
  { id: 'skills', title: 'Skills.exe', icon: '/icons/app-skills.png', glyph: 'skills', group: 'portfolio', size: { width: 600, height: 480 }, keywords: 'stack tools tech languages', onDesktop: true },
  { id: 'lab', title: 'Lab.exe', icon: '/icons/app-lab.png', glyph: 'lab', group: 'portfolio', size: { width: 680, height: 500 }, keywords: 'esp32 telemetry irrigation sensor live demo hardware', onDesktop: true },
  { id: 'downloads', title: 'Resume.exe', icon: '/icons/app-resume.png', glyph: 'resume', group: 'portfolio', size: { width: 540, height: 420 }, keywords: 'cv resume pdf download', onDesktop: true },
  { id: 'contact', title: 'Contact.exe', icon: '/icons/app-contact.png', glyph: 'contact', group: 'portfolio', size: { width: 500, height: 460 }, keywords: 'email github hire message reach', onDesktop: true },
  { id: 'github', title: 'GitHub.exe', icon: '/icons/app-github.png', glyph: 'github', group: 'portfolio', size: { width: 640, height: 520 }, keywords: 'github code repos commits activity open source git', onDesktop: false },
  { id: 'terminal', title: 'Terminal.exe', icon: '/icons/app-terminal.png', glyph: 'terminal', group: 'tools', size: { width: 640, height: 440 }, keywords: 'cli shell command console', onDesktop: true },
  { id: 'explorer', title: 'Explorer.exe', icon: '/icons/app-explorer.png', glyph: 'explorer', group: 'tools', size: { width: 640, height: 460 }, keywords: 'files folders browse', onDesktop: true },
  { id: 'jukebox', title: 'Jukebox.exe', icon: '/icons/app-jukebox.png', glyph: 'jukebox', group: 'tools', size: { width: 480, height: 400 }, keywords: 'music sound audio', onDesktop: false },
  { id: 'paint', title: 'Paint.exe', icon: '/icons/app-paint.png', glyph: 'paint', group: 'tools', size: { width: 500, height: 480 }, keywords: 'draw pixel art', onDesktop: false },
  { id: 'controlpanel', title: 'Settings.exe', icon: '/icons/app-settings.png', glyph: 'settings', group: 'tools', size: { width: 540, height: 440 }, keywords: 'control panel wallpaper crt theme sound settings', onDesktop: false },
  { id: 'snake', title: 'SpiderSnake.exe', icon: '/icons/app-snake.png', glyph: 'snake', group: 'games', size: { width: 480, height: 470 }, keywords: 'game snake play', onDesktop: true },
  { id: 'minesweeper', title: 'Minesweeper.exe', icon: '/icons/app-minesweeper.png', glyph: 'minesweeper', group: 'games', size: { width: 380, height: 470 }, keywords: 'game mines play', onDesktop: true },
];

export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<WindowId, AppDef>;
