import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SwipeableHistoryRow Physics & Snappy Architecture', () => {
  const componentPath = path.resolve(__dirname, '../src/components/SwipeableHistoryRow.tsx');
  const componentCode = fs.readFileSync(componentPath, 'utf8');

  it('uses contextX to store initial translation and prevent touch jumps', () => {
    expect(componentCode).toContain('const contextX = useSharedValue(0);');
    expect(componentCode).toContain('contextX.value = translateX.value;');
    expect(componentCode).toContain('const next = contextX.value + e.translationX;');
  });

  it('leverages Apple Fluid Interfaces rubberbanding and momentum projection', () => {
    expect(componentCode).toContain('function project(');
    expect(componentCode).toContain('function rubberband(');
    expect(componentCode).toContain('withSpring(-ACTION_WIDTH');
    expect(componentCode).toContain('velocity: e.velocityX');
  });

  it('uses low mass and high stiffness spring for instantaneous snappy settle', () => {
    expect(componentCode).toMatch(/mass:\s*0\.6/);
    expect(componentCode).toMatch(/damping:\s*22/);
    expect(componentCode).toMatch(/stiffness:\s*320/);
  });

  it('features dynamic expanding underlay to eliminate visual gaps during overswipe', () => {
    expect(componentCode).toContain('Math.max(ACTION_WIDTH, -translateX.value)');
  });

  it('supports multi-row coordination (isOpen / onSwipeOpen / onSwipeClose)', () => {
    expect(componentCode).toContain('isOpen?: boolean;');
    expect(componentCode).toContain('onSwipeOpen?: () => void;');
    expect(componentCode).toContain('onSwipeClose?: () => void;');
  });

  it('HistoryScreen wires multi-row coordination so at most one row is open', () => {
    const historyPath = path.resolve(__dirname, '../src/screens/HistoryScreen.tsx');
    const historyCode = fs.readFileSync(historyPath, 'utf8');
    expect(historyCode).toContain('const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);');
    expect(historyCode).toContain('isOpen={activeSwipeId ===');
  });

  it('uses signature transaction peachCoral background and deep forestGreen icon/text', () => {
    expect(componentCode).toContain('const deleteBgColor = colors.peachCoral;');
    expect(componentCode).toContain('const deleteContentColor = colors.forestGreen;');
  });
});
