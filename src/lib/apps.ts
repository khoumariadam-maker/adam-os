// Registry of every app window in Adam OS. The window manager, desktop, start menu,
// taskbar and command palette are all built from this list.

export type WindowId =
  | 'about'
  | 'projects'
  | 'skills'
  | 'lab'
  | 'terminal'
  | 'downloads'
  | 'contact'
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
  glyph: string;
  group: AppGroup;
  size: { width: number; height: number };
  keywords: string;
  onDesktop: boolean;
}

export const APPS: AppDef[] = [
  { id: 'about', title: 'About.exe', icon: '/icons/nav-about.png', glyph: '👤', group: 'portfolio', size: { width: 620, height: 480 }, keywords: 'bio story me who adam', onDesktop: true },
  { id: 'projects', title: 'Projects.exe', icon: '/icons/nav-projects.png', glyph: '🛠', group: 'portfolio', size: { width: 760, height: 520 }, keywords: 'work builds portfolio case study', onDesktop: true },
  { id: 'skills', title: 'Skills.exe', icon: '/icons/nav-skills.png', glyph: '⚡', group: 'portfolio', size: { width: 600, height: 480 }, keywords: 'stack tools tech languages', onDesktop: true },
  { id: 'lab', title: 'Lab.exe', icon: '/icons/ui-browser.png', glyph: '📡', group: 'portfolio', size: { width: 680, height: 500 }, keywords: 'esp32 telemetry irrigation sensor live demo hardware', onDesktop: true },
  { id: 'downloads', title: 'Resume.exe', icon: '/icons/file-pdf.png', glyph: '📄', group: 'portfolio', size: { width: 540, height: 420 }, keywords: 'cv resume pdf download', onDesktop: true },
  { id: 'contact', title: 'Contact.exe', icon: '/icons/nav-contact.png', glyph: '✉', group: 'portfolio', size: { width: 500, height: 460 }, keywords: 'email github hire message reach', onDesktop: true },
  { id: 'terminal', title: 'Terminal.exe', icon: '/icons/ui-terminal.png', glyph: '>_', group: 'tools', size: { width: 640, height: 440 }, keywords: 'cli shell command console', onDesktop: true },
  { id: 'explorer', title: 'Explorer.exe', icon: '/icons/ui-folder-open.png', glyph: '📁', group: 'tools', size: { width: 640, height: 460 }, keywords: 'files folders browse', onDesktop: true },
  { id: 'jukebox', title: 'Jukebox.exe', icon: '/icons/ui-ai-spark.png', glyph: '♫', group: 'tools', size: { width: 480, height: 400 }, keywords: 'music sound audio', onDesktop: false },
  { id: 'paint', title: 'Paint.exe', icon: '/icons/file-doc.png', glyph: '🎨', group: 'tools', size: { width: 500, height: 480 }, keywords: 'draw pixel art', onDesktop: false },
  { id: 'controlpanel', title: 'Settings.exe', icon: '/icons/ui-gear.png', glyph: '⚙', group: 'tools', size: { width: 540, height: 440 }, keywords: 'control panel wallpaper crt theme sound settings', onDesktop: false },
  { id: 'snake', title: 'SpiderSnake.exe', icon: '/icons/file-zip.png', glyph: '🐍', group: 'games', size: { width: 480, height: 470 }, keywords: 'game snake play', onDesktop: true },
  { id: 'minesweeper', title: 'Minesweeper.exe', icon: '/icons/ui-close.png', glyph: '💣', group: 'games', size: { width: 380, height: 470 }, keywords: 'game mines play', onDesktop: true },
];

export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<WindowId, AppDef>;
