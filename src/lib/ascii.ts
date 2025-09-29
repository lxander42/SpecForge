/**
 * ASCII art and animations for SpecForge CLI
 * Provides forge-style splash screen and visual elements
 */

import chalk from 'chalk';
import { setTimeout } from 'timers/promises';

// Main SpecForge ASCII art
export const SPECFORGE_LOGO = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗██████╗ ███████╗ ██████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗ ║
║   ██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝ ║
║   ███████╗██████╔╝█████╗  ██║     █████╗  ██║   ██║██████╔╝██║  ███╗█████╗   ║
║   ╚════██║██╔═══╝ ██╔══╝  ██║     ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝   ║
║   ███████║██║     ███████╗╚██████╗██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗ ║
║   ╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ║
║                                                           ║
║              "Where specs are hammered into reality"     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

// Compact logo for smaller displays
export const SPECFORGE_LOGO_COMPACT = `
╔═══════════════════════════════════════╗
║  ███████╗██████╗ ███████╗ ██████╗     ║
║  ██╔════╝██╔══██╗██╔════╝██╔════╝     ║
║  ███████╗██████╔╝█████╗  ██║          ║
║  ╚════██║██╔═══╝ ██╔══╝  ██║          ║
║  ███████║██║     ███████╗╚██████╗     ║
║  ╚══════╝╚═╝     ╚══════╝ ╚═════╝     ║
║                                       ║
║        Hardware Spec Forge            ║
╚═══════════════════════════════════════╝
`;

// Forge-themed decorative elements
export const FORGE_ELEMENTS = {
  hammer: '🔨',
  anvil: '🗜️',
  fire: '🔥',
  gear: '⚙️',
  bolt: '⚡',
  wrench: '🔧',
  blueprint: '📐',
  chip: '🔲',
};

// Animated forge fire
const FIRE_FRAMES = [
  '🔥',
  '🟠',
  '🟡',
  '🔴',
  '🟠',
];

// Progress indicators
export const PROGRESS_CHARS = {
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  dots: ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'],
  bar: ['▱', '▰'],
  forge: ['🔨', '⚒️', '🔧', '⚙️'],
};

// Color themes
export const COLORS = {
  primary: chalk.cyan,
  secondary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  highlight: chalk.magenta,
  forge: chalk.red,
  metal: chalk.white,
  spark: chalk.yellow,
};

// Display functions
export function displayLogo(compact = false): void {
  const logo = compact ? SPECFORGE_LOGO_COMPACT : SPECFORGE_LOGO;
  console.log(COLORS.primary(logo));
}

export function displayWelcome(): void {
  console.log();
  console.log(COLORS.highlight('Welcome to SpecForge!'));
  console.log(COLORS.muted('The hardware specification CLI that bridges innovation and manufacturing.'));
  console.log();
}

export function displayVersion(version: string): void {
  console.log(COLORS.muted(`Version: ${version}`));
}

// Animated splash screen
export async function displayAnimatedSplash(options: {
  version?: string;
  compact?: boolean;
  duration?: number;
} = {}): Promise<void> {
  const { version = '1.0.0', compact = false, duration = 2000 } = options;
  
  // Clear screen
  console.clear();
  
  // Display logo with animation
  displayLogo(compact);
  
  if (version) {
    displayVersion(version);
  }
  
  console.log();
  
  // Animated forge elements
  const forgeAnimation = [
    `${COLORS.forge('🔥')} Heating the forge...`,
    `${COLORS.spark('⚡')} Sparks flying...`,
    `${COLORS.metal('🔨')} Hammering specs...`,
    `${COLORS.success('⚙️')} Ready to build!`,
  ];
  
  for (let i = 0; i < forgeAnimation.length; i++) {
    process.stdout.write(`\\r${' '.repeat(50)}\\r${forgeAnimation[i]}`);
    await setTimeout(duration / forgeAnimation.length);
  }
  
  console.log();
  console.log();
}

// Progress indicators
export class ProgressIndicator {
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private frames: string[];
  
  constructor(message: string, type: 'spinner' | 'dots' | 'forge' = 'spinner') {
    this.message = message;
    this.frames = PROGRESS_CHARS[type];
  }
  
  start(): void {
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\\r${COLORS.primary(frame)} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 100);
  }
  
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (finalMessage) {
      process.stdout.write(`\\r${' '.repeat(this.message.length + 10)}\\r${finalMessage}\\n`);
    } else {
      process.stdout.write(`\\r${' '.repeat(this.message.length + 10)}\\r`);
    }
  }
  
  updateMessage(message: string): void {
    this.message = message;
  }
}

// Status messages
export function displaySuccess(message: string): void {
  console.log(COLORS.success(`✅ ${message}`));
}

export function displayError(message: string): void {
  console.log(COLORS.error(`❌ ${message}`));
}

export function displayWarning(message: string): void {
  console.log(COLORS.warning(`⚠️  ${message}`));
}

export function displayInfo(message: string): void {
  console.log(COLORS.primary(`ℹ️  ${message}`));
}

export function displayStep(step: number, total: number, message: string): void {
  const progress = `[${step}/${total}]`;
  console.log(COLORS.secondary(`${progress} ${message}`));
}

// Boxes and separators
export function displayBox(title: string, content: string[], width = 60): void {
  const topBorder = `╔${'═'.repeat(width - 2)}╗`;
  const bottomBorder = `╚${'═'.repeat(width - 2)}╝`;
  const titleLine = `║ ${COLORS.highlight(title.padEnd(width - 4))} ║`;
  
  console.log(COLORS.primary(topBorder));
  console.log(COLORS.primary(titleLine));
  console.log(COLORS.primary(`║${'─'.repeat(width - 2)}║`));
  
  content.forEach(line => {
    const paddedLine = line.padEnd(width - 4);
    console.log(COLORS.primary(`║ ${paddedLine} ║`));
  });
  
  console.log(COLORS.primary(bottomBorder));
}

export function displaySeparator(char = '─', width = 60): void {
  console.log(COLORS.muted(char.repeat(width)));
}

// Tables
export function displayTable(
  headers: string[],
  rows: string[][],
  options: { maxWidth?: number; colors?: boolean } = {}
): void {
  const { maxWidth = 80, colors = true } = options;
  
  // Calculate column widths
  const colWidths = headers.map((header, i) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map(row => (row[i] || '').length)
    );
    return Math.min(maxContentWidth, Math.floor(maxWidth / headers.length) - 2);
  });
  
  // Helper to truncate text
  const truncate = (text: string, width: number): string => {
    return text.length > width ? text.substring(0, width - 3) + '...' : text;
  };
  
  // Display headers
  const headerRow = headers
    .map((header, i) => truncate(header, colWidths[i]).padEnd(colWidths[i]))
    .join(' │ ');
  
  console.log(colors ? COLORS.highlight(`│ ${headerRow} │`) : `│ ${headerRow} │`);
  
  // Display separator
  const separator = colWidths.map(width => '─'.repeat(width)).join('─┼─');
  console.log(colors ? COLORS.muted(`├─${separator}─┤`) : `├─${separator}─┤`);
  
  // Display rows
  rows.forEach(row => {
    const rowContent = row
      .map((cell, i) => truncate(cell || '', colWidths[i]).padEnd(colWidths[i]))
      .join(' │ ');
    console.log(`│ ${rowContent} │`);
  });
  
  // Bottom border
  const bottomBorder = colWidths.map(width => '─'.repeat(width)).join('─┴─');
  console.log(colors ? COLORS.muted(`└─${bottomBorder}─┘`) : `└─${bottomBorder}─┘`);
}

// Command help formatting
export function displayCommandHelp(
  command: string,
  description: string,
  usage: string,
  options: Array<{ flag: string; description: string; default?: string }>
): void {
  console.log();
  console.log(COLORS.highlight(`${FORGE_ELEMENTS.hammer} ${command.toUpperCase()}`));
  console.log();
  console.log(COLORS.primary(description));
  console.log();
  console.log(COLORS.secondary('USAGE:'));
  console.log(`  ${usage}`);
  console.log();
  
  if (options.length > 0) {
    console.log(COLORS.secondary('OPTIONS:'));
    options.forEach(option => {
      const defaultText = option.default ? ` (default: ${option.default})` : '';
      console.log(`  ${COLORS.primary(option.flag.padEnd(20))} ${option.description}${COLORS.muted(defaultText)}`);
    });
    console.log();
  }
}

// Forge-themed banner
export function displayForgeBanner(message: string): void {
  const banner = `
${COLORS.forge('🔥')} ═══════════════════════════════════════════════ ${COLORS.forge('🔥')}
${COLORS.metal('   ')} ${COLORS.highlight(message.padEnd(43))} ${COLORS.metal('   ')}
${COLORS.forge('🔥')} ═══════════════════════════════════════════════ ${COLORS.forge('🔥')}
`;
  console.log(banner);
}

// Export utility for getting terminal width
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

// Export utility for checking if output should be colored
export function shouldUseColors(): boolean {
  return process.stdout.isTTY && !process.env.NO_COLOR;
}

// Simple splash display function
export async function displaySplash(): Promise<void> {
  await displayAnimatedSplash({ compact: true, duration: 1000 });
}