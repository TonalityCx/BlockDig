export interface Records { score: number; depth: number; bestMs: number | null; minerals: number; }
export interface Preferences { sound: boolean; reducedMotion: boolean; tutorialRead: boolean; }
export class RecordStore {
  records: Records = { score: 0, depth: 0, bestMs: null, minerals: 0 };
  prefs: Preferences = { sound: true, reducedMotion: false, tutorialRead: false };
  available = true;
  readonly key = 'blockdig:v1:first-mine';
  constructor() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const value = JSON.parse(raw);
        const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
        if (value.schema === 1) {
          for (const k of ['score', 'depth', 'minerals'] as const) if (valid(value.records?.[k])) this.records[k] = value.records[k];
          if (valid(value.records?.bestMs) && value.records.bestMs > 0) this.records.bestMs = value.records.bestMs;
          for (const k of ['sound', 'reducedMotion', 'tutorialRead'] as const) if (typeof value.prefs?.[k] === 'boolean') this.prefs[k] = value.prefs[k];
        }
      }
    } catch { this.available = false; }
  }
  save(): void {
    try { localStorage.setItem(this.key, JSON.stringify({ schema: 1, records: this.records, prefs: this.prefs })); }
    catch { this.available = false; }
  }
  settle(score: number, depth: number, minerals: number, ms: number, won: boolean): boolean {
    const newRecord = score > this.records.score;
    this.records.score = Math.max(score, this.records.score);
    this.records.depth = Math.max(depth, this.records.depth);
    this.records.minerals = Math.max(minerals, this.records.minerals);
    if (won && (!this.records.bestMs || ms < this.records.bestMs)) this.records.bestMs = ms;
    this.save(); return newRecord;
  }
}
