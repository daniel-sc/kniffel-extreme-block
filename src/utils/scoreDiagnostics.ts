import { useGameStore } from '@/store/gameStore';
import type { GameCell, GameState } from '@/types/game';
import { calculateGrandTotal } from '@/utils/scoreCalculations';

const ENABLED_KEY = 'kniffel-score-diagnostics-enabled';
const HISTORY_KEY = 'kniffel-score-diagnostics-history';
const MAX_EVENTS = 120;

const readEnabled = (): boolean => {
  try {
    const option = new URLSearchParams(location.search).get('scoreDiagnostics');
    if (option === '1') localStorage.setItem(ENABLED_KEY, 'true');
    if (option === '0') {
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem(HISTORY_KEY);
      return false;
    }
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch (error) {
    console.error('Unable to configure score diagnostics:', error);
    return false;
  }
};

export const scoreDiagnosticsEnabled = readEnabled();

const snapshot = (game: GameState) => ({
  revision: game.updatedAt,
  players: game.players.map((player, index) => ({
    player: index + 1,
    total: calculateGrandTotal(player),
    cells: (['upper', 'lower'] as const).flatMap((section) =>
      Object.entries(player[section]).map(([field, cell]: [string, GameCell]) => ({
        field: `${section}.${field}`,
        value: cell.value,
        struck: cell.struck,
      })),
    ),
  })),
});

const readInputs = (game: GameState) =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[data-score-field]')).map((input) => {
    const index = Number(input.dataset.scorePlayer);
    const section = input.dataset.scoreSection as 'upper' | 'lower';
    const field = input.dataset.scoreField;
    const player = game.players[index];
    const cell = Object.entries(player?.[section] ?? {}).find(([key]) => key === field)?.[1] as GameCell | undefined;
    // Diagnostic only: React 18 keeps its committed props on the host node.
    const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
    const props = propsKey
      ? (input as unknown as Record<string, { value?: string }>)[propsKey]
      : undefined;
    return {
      player: index + 1,
      field: `${section}.${field}`,
      expected: cell ? (cell.struck ? '0' : cell.value === null ? '' : String(cell.value)) : null,
      react: props?.value ?? null,
      dom: input.value,
      focused: document.activeElement === input,
      disabled: input.disabled,
    };
  });

type DiagnosticEvent = ReturnType<typeof createEvent>;
const events: DiagnosticEvent[] = [];
let previousSession: unknown = null;
let started = false;

const createEvent = (kind: string, incoming?: GameState | null) => {
  const state = useGameStore.getState();
  return {
    kind,
    time: new Date().toISOString(),
    elapsed: performance.now(),
    visibility: document.visibilityState,
    documentFocused: document.hasFocus(),
    online: navigator.onLine,
    connection: state.connectionStatus,
    syncReady: state.isSyncReady,
    lastSyncedAt: state.lastSyncedAt,
    state: snapshot(state.gameState),
    inputs: readInputs(state.gameState),
    renderedTotals: Array.from(document.querySelectorAll<HTMLElement>('[data-score-total]')).map((row) => ({
      label: row.dataset.scoreTotal,
      values: Array.from(row.children).slice(1).map((cell) => cell.textContent),
    })),
    ...(incoming !== undefined ? { incoming: incoming ? snapshot(incoming) : null } : {}),
  };
};

// These reads intentionally avoid layout, focus changes, and input value writes.
// A state event may precede React's commit; compare it with the react-commit event.
export const recordScoreDiagnostics = (kind: string, incoming?: GameState | null): void => {
  if (!scoreDiagnosticsEnabled) return;
  try {
    events.push(createEvent(kind, incoming));
    if (events.length > MAX_EVENTS) events.shift();
  } catch (error) {
    console.error('Unable to record score diagnostics:', error);
  }
};

const persistHistory = (): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Unable to save score diagnostic history:', error);
  }
};

export const startScoreDiagnostics = (): void => {
  if (!scoreDiagnosticsEnabled || started) return;
  started = true;
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    previousSession = saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Unable to restore score diagnostic history:', error);
  }
  recordScoreDiagnostics('startup');
  useGameStore.subscribe((state, previous) => {
    if (
      state.gameState !== previous.gameState ||
      state.connectionStatus !== previous.connectionStatus ||
      state.isSyncReady !== previous.isSyncReady
    ) recordScoreDiagnostics('state-before-commit');
  });
  document.addEventListener('visibilitychange', () => {
    recordScoreDiagnostics('visibilitychange');
    if (document.visibilityState === 'hidden') persistHistory();
  });
  window.addEventListener('pagehide', (event) => {
    recordScoreDiagnostics(`pagehide:persisted=${event.persisted}`);
    persistHistory();
  });
  window.addEventListener('pageshow', (event) => {
    recordScoreDiagnostics(`pageshow:persisted=${event.persisted}`);
  });
  for (const kind of ['online', 'offline', 'focus', 'blur']) {
    window.addEventListener(kind, () => recordScoreDiagnostics(`window:${kind}`));
  }
  for (const kind of ['focusin', 'focusout', 'input', 'change']) {
    document.addEventListener(kind, (event) => {
      if (event.target instanceof HTMLInputElement && event.target.dataset.scoreField) {
        recordScoreDiagnostics(`input:${kind}`);
      }
    }, true);
  }
};

export const captureScoreDiagnostics = (): string => {
  recordScoreDiagnostics('manual-capture');
  persistHistory();
  // Only manual capture requests layout. Save values first: geometry reads can
  // themselves repair a stale layout or repaint.
  const layout = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-score-field]')).map((input) => {
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    return {
      player: Number(input.dataset.scorePlayer) + 1,
      field: `${input.dataset.scoreSection}.${input.dataset.scoreField}`,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scroll: { left: input.scrollLeft, top: input.scrollTop, width: input.scrollWidth, height: input.scrollHeight },
      client: { width: input.clientWidth, height: input.clientHeight },
      selection: { start: input.selectionStart, end: input.selectionEnd },
      styles: Object.fromEntries([
        'display', 'box-sizing', 'height', 'width', 'padding-top', 'padding-bottom',
        'padding-left', 'padding-right', 'font-size', 'line-height', 'color',
        '-webkit-text-fill-color', 'opacity', 'visibility', 'overflow-x', 'overflow-y',
      ].map((name) => [name, style.getPropertyValue(name)])),
      // Hit testing is evidence of overlap, not proof of what pixels were painted.
      centerStack: document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        .slice(0, 4).map((element) => ({
          tag: element.tagName,
          classes: element.getAttribute('class'),
          isInput: element === input,
        })),
    };
  });
  return JSON.stringify({
    version: 1,
    build: import.meta.env.VITE_BUILD_TIMESTAMP,
    userAgent: navigator.userAgent,
    standalone: matchMedia('(display-mode: standalone)').matches,
    layoutMeasuredAfterSnapshot: true,
    viewport: {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      visual: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        scale: window.visualViewport.scale,
        offsetLeft: window.visualViewport.offsetLeft,
        offsetTop: window.visualViewport.offsetTop,
      } : null,
    },
    layout,
    previousSession,
    events,
  }, null, 2);
};
