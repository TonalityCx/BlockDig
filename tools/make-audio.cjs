const fs=require('fs'),path=require('path');
const clips={tap:[440,.05],move:[260,.035],lock:[130,.09],clear:[660,.18],ore:[1046,.21],stage:[784,.28],win:[523,.55],lose:[196,.4]};
const root=path.resolve(__dirname,'../assets/resources/audio');fs.mkdirSync(root,{recursive:true});
for(const [name,[frequency,duration]] of Object.entries(clips)){
  const rate=22050,n=Math.floor(rate*duration),buffer=Buffer.alloc(44+n*2);
  buffer.write('RIFF');buffer.writeUInt32LE(36+n*2,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++){const t=i/rate,envelope=Math.min(1,t/.008)*Math.pow(1-i/n,1.8);const pitch=name==='win'?frequency*[1,1.25,1.5,2][Math.min(3,Math.floor(i/n*4))]:name==='lose'?frequency*(1-i/n*.4):frequency;const sample=Math.sin(2*Math.PI*pitch*t)*.75+Math.sin(4*Math.PI*pitch*t)*.12;buffer.writeInt16LE(Math.round(sample*envelope*13000),44+i*2);}
  fs.writeFileSync(path.join(root,name+'.wav'),buffer);
}
console.log('Generated eight original procedural sound effects.');
