export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Cell = PieceKind | 'rock' | 'copper' | 'crystal' | null;
export type Phase = 'playing' | 'clearing' | 'won' | 'lost';
export type Action = 'left' | 'right' | 'rotate' | 'soft' | 'drop' | 'hold';
export interface Row { cells: Cell[]; layer: number | null; }
export interface Piece { kind: PieceKind; rotation: number; x: number; y: number; }
export interface Level {
  id: string; name: string; target: number; initialRows: number;
  rows: { depth: number; cells: string }[];
  stages: { depth: number; name: string; gravityMs: number; color: string }[];
  tuning: { lockMs: number; lockResets: number; clearMs: number; dasMs: number; arrMs: number; softMs: number };
}
export interface GameEvent { type: string; rows?: number[]; lines?: number; layers?: number; replenished?: number; copper?: number; crystal?: number; }
export const WIDTH = 10, HEIGHT = 22, HIDDEN = 2, VISIBLE = 20;
export const KINDS: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const SHAPES: Record<PieceKind, string[]> = {
  I: ['0000', '1111', '0000', '0000'], O: ['11', '11'],
  T: ['010', '111', '000'], S: ['011', '110', '000'], Z: ['110', '011', '000'],
  J: ['100', '111', '000'], L: ['001', '111', '000'],
};
export function blocks(kind: PieceKind, rotation = 0): [number, number][] {
  const n = SHAPES[kind].length;
  const points: [number, number][] = [];
  SHAPES[kind].forEach((row, y) => row.split('').forEach((cell, x) => {
    if (cell !== '1') return;
    let px = x, py = y;
    if (kind !== 'O') for (let r = 0; r < rotation % 4; r++) [px, py] = [n - 1 - py, px];
    points.push([px, py]);
  }));
  return points;
}
export function emptyRow(): Row { return { cells: Array(WIDTH).fill(null), layer: null }; }
export function terrainRow(row: Level['rows'][number]): Row {
  return { layer: row.depth, cells: row.cells.split('').map(c => c === '.' ? null : c === 'c' ? 'copper' : c === 'x' ? 'crystal' : 'rock') };
}
export function validateLevel(level: Level): void {
  if (level.target !== level.rows.length || level.initialRows < 1 || level.initialRows > VISIBLE - 4) throw new Error('地层数量配置不合法');
  level.rows.forEach((row, i) => {
    if (row.depth !== i + 1 || !/^[#.cx]{10}$/.test(row.cells)) throw new Error(`第${i + 1}层配置不合法`);
    const gap = row.cells.match(/\.+/g) || [];
    if (gap.length !== 1 || gap[0].length < 2 || gap[0].length > 4) throw new Error(`第${i + 1}层需要连续的2至4格缺口`);
  });
}

/** Game rules deliberately have no engine, browser, clock or storage dependencies. */
export class GameModel {
  board: Row[] = [];
  active: Piece | null = null;
  held: PieceKind | null = null;
  canHold = true;
  queue: PieceKind[] = [];
  bag: PieceKind[] = [];
  rng = 1;
  phase: Phase = 'playing';
  paused = false;
  depth = 0;
  score = 0;
  copper = 0;
  crystal = 0;
  elapsedMs = 0;
  introduced = 0;
  gravityClock = 0;
  gravityMs = 900;
  lockClock = 0;
  lockResets = 0;
  clearClock = 0;
  pendingRows: number[] = [];
  revision = 0;
  events: GameEvent[] = [];
  piecesPlaced = 0;

  constructor(public level: Level, public seed = 1) {
    validateLevel(level);
    this.rng = seed >>> 0 || 1;
    this.board = Array.from({ length: HEIGHT }, emptyRow);
    for (let i = 0; i < level.initialRows; i++) this.board[HEIGHT - level.initialRows + i] = terrainRow(level.rows[i]);
    this.introduced = level.initialRows;
    this.fillQueue();
    this.spawn();
  }
  random(): number {
    let v = this.rng; v ^= v << 13; v ^= v >>> 17; v ^= v << 5;
    this.rng = v >>> 0; return this.rng / 4294967296;
  }
  fillQueue(): void {
    while (this.queue.length < 5) {
      if (!this.bag.length) {
        this.bag = [...KINDS];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.queue.push(this.bag.pop()!);
    }
  }
  get stage(): Level['stages'][number] {
    return [...this.level.stages].reverse().find(s => this.depth >= s.depth) || this.level.stages[0];
  }
  get ended(): boolean { return this.phase === 'won' || this.phase === 'lost'; }
  spawn(kind?: PieceKind): void {
    const next = kind || this.queue.shift()!;
    this.fillQueue();
    this.active = { kind: next, rotation: 0, x: Math.floor((WIDTH - SHAPES[next].length) / 2), y: 1 };
    this.gravityClock = 0; this.lockClock = 0; this.lockResets = 0;
    this.gravityMs = this.stage.gravityMs;
    if (!this.fits(this.active)) this.finish('lost');
    this.revision++;
  }
  fits(piece: Piece): boolean {
    return blocks(piece.kind, piece.rotation).every(([dx, dy]) => {
      const x = piece.x + dx, y = piece.y + dy;
      return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && !this.board[y].cells[x];
    });
  }
  grounded(): boolean { return !!this.active && !this.fits({ ...this.active, y: this.active.y + 1 }); }
  ghost(): Piece | null {
    if (!this.active) return null;
    const p = { ...this.active };
    while (this.fits({ ...p, y: p.y + 1 })) p.y++;
    return p;
  }
  tryTransform(piece: Piece): boolean {
    if (!this.fits(piece)) return false;
    if (this.grounded() && this.lockResets < this.level.tuning.lockResets) {
      this.lockClock = 0; this.lockResets++;
    }
    this.active = piece; this.revision++; return true;
  }
  act(action: Action): boolean {
    if (this.paused || this.phase !== 'playing' || !this.active) return false;
    const p = this.active;
    if (action === 'left' || action === 'right') return this.tryTransform({ ...p, x: p.x + (action === 'left' ? -1 : 1) });
    if (action === 'soft') {
      if (!this.fits({ ...p, y: p.y + 1 })) return false;
      this.active = { ...p, y: p.y + 1 }; this.gravityClock = 0; this.revision++; return true;
    }
    if (action === 'rotate') {
      if (p.kind === 'O') return false;
      // Explicit v0.1 kick rule, in priority order. Coordinates use downward-positive Y.
      const offsets = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [0, -2]];
      for (const [dx, dy] of offsets) if (this.tryTransform({ ...p, rotation: (p.rotation + 1) % 4, x: p.x + dx, y: p.y + dy })) return true;
      return false;
    }
    if (action === 'drop') {
      this.active = this.ghost(); this.lock(); return true;
    }
    if (action === 'hold' && this.canHold) {
      const old = this.held; this.held = p.kind; this.canHold = false;
      this.spawn(old || undefined); this.events.push({ type: 'hold' }); return true;
    }
    return false;
  }
  advance(milliseconds: number): void {
    if (this.paused || this.ended || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
    let remaining = milliseconds;
    while (remaining > 0 && !this.paused && !this.ended) {
      const dt = Math.min(remaining, 10); remaining -= dt; this.elapsedMs += dt;
      if (this.phase === 'clearing') {
        this.clearClock += dt;
        if (this.clearClock >= this.level.tuning.clearMs) this.resolveRows();
        continue;
      }
      this.gravityClock += dt;
      if (this.gravityClock >= this.gravityMs && this.active) {
        this.gravityClock -= this.gravityMs;
        if (this.fits({ ...this.active, y: this.active.y + 1 })) { this.active.y++; this.revision++; }
      }
      if (this.grounded()) {
        this.lockClock += dt;
        if (this.lockClock >= this.level.tuning.lockMs) this.lock();
      }
    }
  }
  lock(): void {
    if (!this.active || this.phase !== 'playing') return;
    const p = this.active;
    blocks(p.kind, p.rotation).forEach(([dx, dy]) => { this.board[p.y + dy].cells[p.x + dx] = p.kind; });
    this.active = null; this.piecesPlaced++; this.revision++;
    this.events.push({ type: 'lock' });
    this.pendingRows = this.board.map((row, y) => row.cells.every(Boolean) ? y : -1).filter(y => y >= 0);
    if (this.pendingRows.length) {
      this.phase = 'clearing'; this.clearClock = 0;
      this.events.push({ type: 'clear-start', rows: [...this.pendingRows] });
    } else this.nextTurn();
  }
  resolveRows(): void {
    if (this.phase !== 'clearing') return;
    const removed = this.pendingRows.map(y => this.board[y]);
    const layers = removed.filter(row => row.layer !== null).length;
    const copper = removed.reduce((sum, row) => sum + row.cells.filter(c => c === 'copper').length, 0);
    const crystal = removed.reduce((sum, row) => sum + row.cells.filter(c => c === 'crystal').length, 0);
    this.score += ([0, 100, 300, 500, 800][removed.length] || removed.length * 200) + copper * 50 + crystal * 200;
    this.copper += copper; this.crystal += crystal; this.depth += layers;
    const indexes = new Set(this.pendingRows);
    this.board = this.board.filter((_, y) => !indexes.has(y));
    while (this.board.length < HEIGHT) this.board.unshift(emptyRow());
    const newLayers = Math.min(layers, this.level.rows.length - this.introduced);
    for (let i = 0; i < newLayers; i++) {
      this.board.shift(); this.board.push(terrainRow(this.level.rows[this.introduced++]));
    }
    this.pendingRows = []; this.clearClock = 0; this.revision++;
    this.events.push({ type: 'clear', lines: removed.length, layers, replenished: newLayers, copper, crystal });
    this.nextTurn();
  }
  nextTurn(): void {
    if (this.depth >= this.level.target) { this.score += 1000; this.finish('won'); return; }
    if (this.board.slice(0, HIDDEN).some(row => row.cells.some(Boolean))) { this.finish('lost'); return; }
    this.phase = 'playing'; this.canHold = true; this.spawn();
  }
  finish(phase: 'won' | 'lost'): void { this.phase = phase; this.active = null; this.revision++; this.events.push({ type: phase }); }
  drainEvents(): GameEvent[] { const events = this.events; this.events = []; return events; }
  clone(): GameModel {
    const copy = Object.create(GameModel.prototype) as GameModel;
    Object.assign(copy, this);
    copy.board = this.board.map(row => ({ cells: [...row.cells], layer: row.layer }));
    copy.active = this.active ? { ...this.active } : null;
    copy.queue = [...this.queue]; copy.bag = [...this.bag]; copy.pendingRows = [...this.pendingRows]; copy.events = [];
    return copy;
  }
}
