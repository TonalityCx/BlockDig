const fs=require('fs'),path=require('path'),{GameModel}=require('./rules-loader.cjs');
const level=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/resources/levels/first-mine.json'),'utf8'));
const witness=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/validation/first-mine-witness.json'),'utf8'));
const game=new GameModel(level,witness.seed);
for(const [i,move] of witness.moves.entries()){
  if(game.active?.kind!==move.kind)throw new Error(`Piece ${i+1} differs from witness`);
  for(const action of move.actions)if(!game.act(action))throw new Error(`Illegal action ${action} in piece ${i+1}`);
  if(game.phase==='clearing')game.advance(200);
}
if(game.phase!=='won'||game.depth!==30||game.score!==witness.score)throw new Error('Witness does not reach the configured goal');
console.log(`PASS: seed ${witness.seed}, ${game.piecesPlaced} pieces, ${game.depth}m, ${game.score} points, ${game.copper} copper + ${game.crystal} crystal.`);
