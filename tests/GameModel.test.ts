import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { GameModel, HEIGHT, emptyRow, blocks, validateLevel, type Level } from '../assets/scripts/core/GameModel';
const level: Level = JSON.parse(fs.readFileSync(new URL('../assets/resources/levels/first-mine.json',import.meta.url),'utf8'));
const blank = () => { const game=new GameModel(level,123); game.board=Array.from({length:HEIGHT},emptyRow); return game; };
const resolve = (game: GameModel, rows: number[]) => { game.active=null; game.pendingRows=rows; game.phase='clearing'; game.advance(200); };
describe('mining settlement',()=>{
  it('validates all thirty configured layers',()=>{expect(()=>validateLevel(level)).not.toThrow();});
  it('normal rows score without depth or terrain replenishment',()=>{
    const game=blank(); game.board[21].cells.fill('T'); const introduced=game.introduced;
    resolve(game,[21]); expect(game.score).toBe(100);expect(game.depth).toBe(0);expect(game.introduced).toBe(introduced);
  });
  it('three mixed rows add two metres and two layers with each mineral counted once',()=>{
    const game=blank(); for(const y of [19,20,21])game.board[y].cells.fill('L');
    game.board[20].layer=1;game.board[21].layer=2;game.board[20].cells[0]='copper';game.board[21].cells[9]='crystal';
    resolve(game,[19,20,21]);expect(game.depth).toBe(2);expect(game.introduced).toBe(8);expect(game.score).toBe(750);
    expect(game.copper).toBe(1);expect(game.crystal).toBe(1);expect(game.board).toHaveLength(22);
    game.advance(10);expect(game.score).toBe(750);
  });
  it('exhausts the finite reserve and awards a single win before spawn failure',()=>{
    const game=blank();game.depth=29;game.introduced=30;game.board[21].cells.fill('I');game.board[21].layer=30;
    game.board[0].cells.fill('rock');resolve(game,[21]);expect(game.phase).toBe('won');expect(game.score).toBe(1100);
    game.advance(5000);expect(game.score).toBe(1100);expect(game.introduced).toBe(30);
  });
  it('preserves metadata and shifts all surviving rows exactly once',()=>{
    const game=blank();game.board[20].cells[0]='J';game.board[20].layer=4;game.board[21].cells.fill('I');game.board[21].layer=5;
    resolve(game,[21]);expect(game.board[20].cells[0]).toBe('J');expect(game.board[20].layer).toBe(4);expect(game.board[21].layer).toBe(7);
  });
  it('fails once when hidden cells remain after a non-clearing lock',()=>{
    const game=blank();game.board[0].cells[0]='T';game.active={kind:'O',rotation:0,x:4,y:20};game.act('drop');
    expect(game.phase).toBe('lost');expect(game.drainEvents().filter(e=>e.type==='lost')).toHaveLength(1);expect(game.act('drop')).toBe(false);
  });
});
describe('piece controls and timing',()=>{
  it('distributes every piece once in each seven bag',()=>{
    const game=blank(),kinds=[];for(let i=0;i<14;i++){kinds.push(game.active!.kind);game.spawn();}
    expect(new Set(kinds.slice(0,7)).size).toBe(7);expect(new Set(kinds.slice(7,14)).size).toBe(7);
  });
  it('hard drop locks at the ghost position and prevents post-lock inputs during clearing',()=>{
    const game=blank();game.active={kind:'I',rotation:0,x:3,y:1};game.board[21].cells.fill('rock');for(let x=3;x<7;x++)game.board[21].cells[x]=null;
    expect(game.ghost()!.y).toBe(20);game.act('drop');expect(game.phase).toBe('clearing');expect(game.act('left')).toBe(false);
  });
  it('permits hold once per falling piece and resets the swapped pose',()=>{
    const game=blank(),first=game.active!.kind;expect(game.act('hold')).toBe(true);expect(game.held).toBe(first);expect(game.act('hold')).toBe(false);
    game.act('drop');expect(game.canHold).toBe(true);game.act('hold');expect(game.active!.kind).toBe(first);expect(game.active!.rotation).toBe(0);
  });
  it('does not advance any timer or input while paused',()=>{
    const game=blank();game.paused=true;const before=JSON.stringify(game);game.advance(50000);expect(game.act('drop')).toBe(false);expect(JSON.stringify(game)).toBe(before);
  });
  it('allows floor rotation of I using the documented upward correction',()=>{
    const game=blank();game.active={kind:'I',rotation:0,x:3,y:20};expect(game.act('rotate')).toBe(true);expect(game.active!.y).toBe(18);expect(game.fits(game.active!)).toBe(true);
  });
  it('caps lock timer resets even when valid grounded moves continue',()=>{
    const game=blank();game.active={kind:'O',rotation:0,x:4,y:20};
    for(let i=0;i<10;i++){game.advance(100);game.act(i%2?'right':'left');}
    expect(game.lockResets).toBe(8);game.advance(500);expect(game.piecesPlaced).toBe(1);
  });
  it('clones random state and reproduces an identical sequence',()=>{
    const game=blank(),copy=game.clone();for(let i=0;i<6;i++){game.act('drop');copy.act('drop');game.advance(220);copy.advance(220);}
    expect(JSON.stringify(copy.board)).toBe(JSON.stringify(game.board));expect(copy.queue).toEqual(game.queue);expect(copy.score).toBe(game.score);
  });
  it('keeps all piece rotations at exactly four unique cells',()=>{
    for(const kind of ['I','O','T','S','Z','J','L'] as const)for(let r=0;r<4;r++)expect(new Set(blocks(kind,r).map(p=>p.join(','))).size).toBe(4);
  });
});
