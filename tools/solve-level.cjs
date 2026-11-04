const fs=require('fs'),path=require('path');
const {GameModel,blocks}=require('./rules-loader.cjs');
const level=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/resources/levels/first-mine.json'),'utf8'));
const seed=Number(process.argv[2]||42),width=Number(process.argv[3]||36);
function placements(game){
  const start=game.active,queue=[{p:{...start},actions:[]}],seen=new Set([`${start.x},${start.y},${start.rotation}`]),out=[];
  for(let i=0;i<queue.length;i++){
    const {p,actions}=queue[i];
    if(!game.fits({...p,y:p.y+1}))out.push({p,actions:[...actions,'drop']});
    const candidates=[{p:{...p,x:p.x-1},action:'left'},{p:{...p,x:p.x+1},action:'right'},{p:{...p,y:p.y+1},action:'soft'}];
    if(p.kind!=='O')for(const [dx,dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]]){
      const rotated={...p,rotation:(p.rotation+1)%4,x:p.x+dx,y:p.y+dy};if(game.fits(rotated)){candidates.push({p:rotated,action:'rotate'});break;}
    }
    for(const candidate of candidates){const n=candidate.p,key=`${n.x},${n.y},${n.rotation}`;if(!seen.has(key)&&game.fits(n)){seen.add(key);queue.push({p:n,actions:[...actions,candidate.action]});}}
  }
  return out;
}
function estimate(game){
  if(game.phase==='won')return 1e9;
  let holes=0,heights=[];
  for(let x=0;x<10;x++){let found=false,height=0;for(let y=2;y<22;y++){if(game.board[y].cells[x]){if(!found)height=22-y;found=true;}else if(found)holes++;}heights.push(height);}
  const aggregate=heights.reduce((a,b)=>a+b,0),bump=heights.slice(1).reduce((s,h,i)=>s+Math.abs(h-heights[i]),0),max=Math.max(...heights);
  return game.depth*850+game.score*.03-holes*90-aggregate*3-bump*3-max*12;
}
const initial=new GameModel(level,seed);let beam=[{game:initial,moves:[],quality:estimate(initial)}],winner=null;
for(let turn=0;turn<110&&!winner;turn++){
  const candidates=[],dedup=new Set();
  for(const state of beam){
    const variants=[{game:state.game,held:false}];if(state.game.canHold){const held=state.game.clone();held.act('hold');if(held.phase!=='lost')variants.push({game:held,held:true});}
    for(const variant of variants)for(const landing of placements(variant.game)){
      const game=variant.game.clone(),actions=variant.held?['hold',...landing.actions]:landing.actions;
      game.active={...landing.p};game.act('drop');if(game.phase==='clearing')game.advance(200);if(game.phase==='lost')continue;
      const key=game.board.map(r=>r.cells.map(c=>c||'.').join('')).join('|')+'|'+game.active?.kind+'|'+game.held+'|'+game.queue.join('');
      if(dedup.has(key))continue;dedup.add(key);
      const entry={game,moves:[...state.moves,{kind:state.game.active.kind,actions}],quality:estimate(game)};
      if(game.phase==='won'){winner=entry;break;}candidates.push(entry);
    }
    if(winner)break;
  }
  candidates.sort((a,b)=>b.quality-a.quality);beam=candidates.slice(0,width);
  if(!beam.length)throw new Error('No surviving play sequence');
  if(turn%5===0)console.log(`Turn ${turn+1}: depth ${beam[0].game.depth}, beam ${beam.length}`);
}
if(!winner)throw new Error('Search did not find a solution within the current budget');
const witness={version:1,levelId:level.id,seed,pieces:winner.game.piecesPlaced,score:winner.game.score,depth:winner.game.depth,copper:winner.game.copper,crystal:winner.game.crystal,moves:winner.moves,note:'Deterministic legal action witness. Validates geometry and bag sequence, not human reaction time or all random seeds.'};
const file=path.resolve(__dirname,'../docs/validation/first-mine-witness.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(witness,null,2));console.log(`Solved: ${witness.depth} metres, ${witness.pieces} pieces. Saved ${file}`);
