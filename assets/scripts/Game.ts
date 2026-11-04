import { _decorator, Component, Node, Canvas, UITransform, Camera, Layers, Graphics, Color, Label, director, view, ResolutionPolicy, resources, JsonAsset, AudioClip, AudioSource, game, Game, EventTouch, profiler, Mask, input, Input, EventKeyboard, KeyCode } from 'cc';
import { GameModel, blocks, HIDDEN, WIDTH, type Action, type Cell, type PieceKind, type Level } from './core/GameModel';
import { RecordStore } from './services/RecordStore';

const { ccclass } = _decorator;
const C = { bg:'#0b1222', panel:'#141e30', edge:'#2b3549', text:'#eee9dc', muted:'#8997ac', gold:'#efbd72', teal:'#70d2c0', dark:'#080e19' };
const PIECE: Record<PieceKind,string> = {I:'#70c8d8',O:'#e8c16a',T:'#b295d4',S:'#8cbf91',Z:'#d88988',J:'#7e9dce',L:'#dea76d'};
type Page = 'loading'|'home'|'tutorial'|'settings'|'game'|'result'|'error';
interface Held { action: Action; time: number; next: number; serial: number; }
interface Particle {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;targetX?:number;targetY?:number;}
function color(hex:string,alpha=255):Color { const c=new Color(hex);c.a=alpha;return c; }
function time(ms:number|null):string { if(ms===null)return '—';const s=Math.floor(ms/1000);return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }

@ccclass('BlockDigGame')
export class BlockDigGame extends Component {
  private root!:Node; private screen!:Node; private camera!:Camera;
  private level!:Level; private model:GameModel|null=null; private store=new RecordStore();
  private page:Page='loading'; private returnPage:Page='home'; private tutorialStartsGame=false;
  private w=390; private h=844; private safeTop=0; private safeBottom=0;
  private left=0;private boardTop=0;private cell=22;private boardWidth=220;private contentWidth=358;
  private boardG:Graphics|null=null;private frameG:Graphics|null=null;private previewG:Graphics|null=null;private effectsG:Graphics|null=null;
  private riseMs=0;private riseAmount=0;
  private hud:Record<string,Label>={};private lastRevision=-1;private lastStage=0;
  private paused=false;private countdown=0;private confirmAction:'restart'|'home'|null=null;
  private holds=new Map<string,Held>();private serial=0;private settled=false;private newRecord=false;
  private particles:Particle[]=[];private toast='';private toastTime=0;
  private clips:Record<string,AudioClip>={};private audio!:AudioSource;
  private errorText=''; private resizeTimer:ReturnType<typeof setTimeout>|null=null;
  private buttonBounds:Record<string,{x:number;y:number;width:number;height:number}>={};
  private onResize=()=>{if(this.resizeTimer)clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{if(this.page==='game')this.pause();this.resize();this.draw();},120);};
  private onHide=()=>this.pause();
  private onKeyDown=(event:EventKeyboard)=>{
    if(this.page!=='game')return;
    const actions:Record<number,Action>={[KeyCode.ARROW_LEFT]:'left',[KeyCode.ARROW_RIGHT]:'right',[KeyCode.ARROW_DOWN]:'soft',[KeyCode.ARROW_UP]:'rotate',[KeyCode.SPACE]:'drop',[KeyCode.KEY_C]:'hold',[KeyCode.SHIFT_LEFT]:'hold',[KeyCode.SHIFT_RIGHT]:'hold'};
    if(event.keyCode===KeyCode.ESCAPE){
      if(this.confirmAction){this.confirmAction=null;this.draw();}
      else if(this.paused)this.resume();
      else this.pause();
      return;
    }
    const action=actions[event.keyCode];if(action)this.press('key:'+event.keyCode,action);
  };
  private onKeyUp=(event:EventKeyboard)=>this.holds.delete('key:'+event.keyCode);

  start():void {
    profiler.hideStats();
    this.root=new Node('GameCanvas');director.getScene()!.addChild(this.root);this.root.layer=Layers.Enum.UI_2D;
    this.root.addComponent(UITransform);const canvas=this.root.addComponent(Canvas);
    const cameraNode=new Node('UICamera');this.root.addChild(cameraNode);this.camera=cameraNode.addComponent(Camera);
    this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.visibility=Layers.Enum.UI_2D;this.camera.clearColor=color(C.bg);this.camera.far=2000;this.camera.near=0.1;
    canvas.cameraComponent=this.camera;this.audio=this.node.addComponent(AudioSource);
    this.resize();this.draw();
    window.addEventListener('resize',this.onResize);window.addEventListener('blur',this.onHide);
    input.on(Input.EventType.KEY_DOWN,this.onKeyDown,this);input.on(Input.EventType.KEY_UP,this.onKeyUp,this);
    game.on(Game.EVENT_HIDE,this.onHide,this);
    this.load();
    if(new URLSearchParams(location.search).has('qa')) {
      (window as any).__BLOCKDIG__={
        state:()=>({page:this.page,paused:this.paused,countdown:this.countdown,width:this.w,height:this.h,buttons:this.buttonBounds,phase:this.model?.phase,depth:this.model?.depth,score:this.model?.score,active:this.model?.active,held:this.model?.held,canHold:this.model?.canHold,elapsed:this.model?.elapsedMs,board:this.model?.board,queue:this.model?.queue,pieces:this.model?.piecesPlaced,prefs:this.store.prefs,records:this.store.records}),
        start:(seed=42)=>{this.newGame(seed);this.countdown=0;this.model!.paused=false;this.draw();},
        model:()=>this.model,action:(a:Action)=>this.action(a),advance:(ms:number)=>{this.model?.advance(ms);this.consumeEvents();},
      };
    }
  }
  private load():void {
    resources.load('levels/first-mine',JsonAsset,(error,asset)=>{
      if(error){this.page='error';this.errorText='矿井资料加载失败，请检查连接后重试。';this.draw();return;}
      try{this.level=asset.json as Level;new GameModel(this.level,1);this.page='home';this.draw();}
      catch{this.page='error';this.errorText='矿井配置校验失败，请重新加载。';this.draw();}
    });
    for(const name of ['tap','move','lock','clear','ore','stage','win','lose'])resources.load('audio/'+name,AudioClip,(error,clip)=>{if(!error)this.clips[name]=clip;});
  }
  private sound(name:string):void {if(this.store.prefs.sound&&this.clips[name])this.audio.playOneShot(this.clips[name],name==='move'?0.13:0.4);}
  private resize():void {
    this.w=Math.max(240,window.innerWidth);this.h=Math.max(320,window.innerHeight);
    const probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';document.body.appendChild(probe);
    const style=getComputedStyle(probe);this.safeTop=parseFloat(style.paddingTop)||0;this.safeBottom=parseFloat(style.paddingBottom)||0;probe.remove();
    view.setDesignResolutionSize(this.w,this.h,ResolutionPolicy.EXACT_FIT);
    this.root.setPosition(this.w/2,this.h/2);this.root.getComponent(UITransform)!.setContentSize(this.w,this.h);
    this.camera.node.setWorldPosition(this.w/2,this.h/2,1000);this.camera.orthoHeight=this.h/2;
    this.contentWidth=Math.min(this.w-32,420);this.particles=[];
    document.documentElement.style.background=C.bg;document.body.style.overscrollBehavior='none';
  }
  private createNode(parent:Node,name:string,x=0,y=0,w=0,h=0):Node {
    const node=new Node(name);node.layer=Layers.Enum.UI_2D;parent.addChild(node);node.setPosition(x,y);node.addComponent(UITransform).setContentSize(w,h);return node;
  }
  private graphics(parent:Node,name:string):Graphics{return this.createNode(parent,name).addComponent(Graphics);}
  private rect(g:Graphics,x:number,y:number,w:number,h:number,fill:string,alpha=255):void{g.fillColor=color(fill,alpha);g.rect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));g.fill();}
  private label(parent:Node,text:string,x:number,y:number,size=14,tint=C.text,width=300,align='center',bold=false):Label{
    const node=this.createNode(parent,text.slice(0,20),x,y,width,size*2.4);const label=node.addComponent(Label);
    label.string=text;label.fontSize=size;label.lineHeight=size*1.35;label.color=color(tint);label.isBold=bold;label.fontFamily='sans-serif';
    label.horizontalAlign=align==='left'?Label.HorizontalAlign.LEFT:align==='right'?Label.HorizontalAlign.RIGHT:Label.HorizontalAlign.CENTER;
    label.verticalAlign=Label.VerticalAlign.CENTER;label.overflow=Label.Overflow.SHRINK;return label;
  }
  private button(parent:Node,id:string,text:string,x:number,y:number,w:number,h:number,callback:()=>void,accent=false,action?:Action):Node{
    const node=this.createNode(parent,id,x,y,w,h),g=node.addComponent(Graphics);
    const paint=(pressed=false)=>{g.clear();this.rect(g,-w/2,-h/2-3,w,h,accent?'#805b35':'#101726');this.rect(g,-w/2,-h/2,w,h,accent?(pressed?'#d6a25d':C.gold):(pressed?'#344158':'#202c40'));this.rect(g,-w/2+1,h/2-2,w-2,2,accent?'#f9d99d':'#3b4960');};paint();
    this.label(node,text,0,0,action&&['left','right','soft','rotate'].includes(action)?21:16,accent?'#33291e':C.text,w-8,'center',true);
    this.buttonBounds[id]={x:this.w/2+x,y:this.h/2-y,width:w,height:h};
    let armed=false;
    node.on(Node.EventType.TOUCH_START,(event:EventTouch)=>{event.propagationStopped=true;armed=true;paint(true);if(action)this.press('touch:'+event.getID(),action);},this);
    node.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{event.propagationStopped=true;this.holds.delete('touch:'+event.getID());paint();if(armed&&!action){this.sound('tap');callback();}armed=false;},this);
    node.on(Node.EventType.TOUCH_CANCEL,(event:EventTouch)=>{event.propagationStopped=true;this.holds.delete('touch:'+event.getID());armed=false;paint();},this);
    node.on(Node.EventType.TOUCH_MOVE,(event:EventTouch)=>{
      const p=event.getUILocation(),b=this.buttonBounds[id];if(!b)return;
      if(Math.abs(p.x-b.x)>w/2||Math.abs((this.h-p.y)-b.y)>h/2){armed=false;this.holds.delete('touch:'+event.getID());paint();}
    },this);
    return node;
  }
  private background(parent:Node):void{
    const g=this.graphics(parent,'Mine walls');this.rect(g,-this.w/2,-this.h/2,this.w,this.h,C.bg);
    for(let y=-this.h/2;y<this.h/2;y+=32){
      const shift=(Math.floor(y/32)%2)*18;
      for(let x=-this.w/2-32;x<this.w/2;x+=43){
        const edge=Math.abs(x)>Math.min(this.w/2-35,205);
        if(edge){this.rect(g,x+shift,y,40,29,'#121b2c');this.rect(g,x+shift+2,y+26,35,2,'#1d293a');}
      }
    }
    for(let i=0;i<17;i++){
      const x=((i*137+29)%Math.max(1,this.w-30))-this.w/2+15,y=((i*197+39)%this.h)-this.h/2;
      if(Math.abs(x)>this.contentWidth/2-20)this.rect(g,x,y,i%3===0?3:2,i%3===0?3:2,i%3===0?'#806c48':'#2b3b51');
    }
    this.rect(g,-this.contentWidth/2,this.h/2-this.safeTop-1,this.contentWidth,1,'#243043');
  }
  private crystal(g:Graphics,x:number,y:number,s:number,tint=C.teal):void{
    g.fillColor=color(tint);g.moveTo(x,y+s);g.lineTo(x+s*.7,y+s*.25);g.lineTo(x+s*.45,y-s*.7);g.lineTo(x-s*.4,y-s*.9);g.lineTo(x-s*.7,y+s*.15);g.close();g.fill();
    g.fillColor=color('#d2f5e5',180);g.moveTo(x,y+s);g.lineTo(x+s*.12,y);g.lineTo(x-s*.4,y-s*.9);g.lineTo(x-s*.7,y+s*.15);g.close();g.fill();
    this.rect(g,x-s*1.1,y+s*.8,3,3,C.gold);this.rect(g,x+s,y-s*.5,2,2,C.gold);
  }
  private miner(g:Graphics,x:number,y:number,s=3):void{
    const sprite=['....aaaa....','...aaaaaa...','..aaaaaaaa..','..aayyyaaa..','....bbbb....','...bccbb....','....bbbb....','...dddddd...','..dddddddd..','..ddddd.dd..','...eeeeee...','...ee..ee...','..fff..fff..'];
    const palette:Record<string,string>={a:'#e6ad60',y:'#fff2b6',b:'#dfb28b',c:'#252c3c',d:'#6b9b9c',e:'#4b5975',f:'#303748'};
    sprite.forEach((row,py)=>row.split('').forEach((ch,px)=>{if(palette[ch])this.rect(g,x+(px-6)*s,y+(6-py)*s,s,s,palette[ch]);}));
  }
  private draw():void{
    if(this.screen)this.screen.destroy();this.screen=this.createNode(this.root,'Screen');this.hud={};this.buttonBounds={};this.boardG=null;this.previewG=null;this.effectsG=null;this.lastRevision=-1;
    this.background(this.screen);
    if(this.page==='home')this.drawHome();else if(this.page==='tutorial')this.drawTutorial();else if(this.page==='settings')this.drawSettings();else if(this.page==='game')this.drawGame();else if(this.page==='result')this.drawResult();
    else{this.label(this.screen,this.page==='error'?'矿井暂时无法打开':'正在点亮矿灯',0,30,24,C.gold,320,'center',true);this.label(this.screen,this.errorText||'方块深掘 · 第一矿井',0,-16,14,C.muted);if(this.page==='error')this.button(this.screen,'retry','重新加载',0,-90,220,52,()=>location.reload(),true);}
    if(this.w>this.h){const g=this.graphics(this.screen,'Orientation');this.rect(g,-this.w/2,-this.h/2,this.w,this.h,C.bg,248);this.label(this.screen,'请竖起手机',0,22,28,C.gold);this.label(this.screen,'矿井探索采用竖屏，当前对局已暂停',0,-25,15,C.muted,400);}
  }
  private drawHome():void{
    const top=this.h/2-this.safeTop,small=this.h<720;
    this.label(this.screen,'BLOCK DIG  /  EXPEDITION 01',0,top-47,11,C.muted,340);
    this.button(this.screen,'sound-home',this.store.prefs.sound?'音效 开':'音效 关',this.contentWidth/2-30,top-84,60,44,()=>{this.store.prefs.sound=!this.store.prefs.sound;this.store.save();this.draw();});
    const heroY=small?top-202:top-260,g=this.graphics(this.screen,'Mine illustration');
    this.rect(g,-81,heroY-48,162,106,'#1c2737');this.rect(g,-74,heroY-41,148,97,'#101a29');
    for(let r=0;r<4;r++)for(let c=0;c<7;c++)if(!(r<3&&c>=2&&c<=4)){
      const x=-70+c*20,y=heroY-35+r*20;this.rect(g,x,y,18,18,r%2?'#384254':'#303b4e');this.rect(g,x+2,y+14,13,2,'#4b5360');
    }
    this.crystal(g,12,heroY-4,26);this.miner(g,-45,heroY+72,3);
    this.rect(g,-80,heroY+54,160,3,'#735b40');this.rect(g,-85,heroY-54,170,3,'#3e4149');
    for(let i=0;i<5;i++)this.rect(g,90+i*5,heroY+65-i*19,2,2,C.gold,120);
    const titleY=heroY-(small?103:120);
    this.label(this.screen,'方块深掘',0,titleY,44,C.text,340,'center',true);
    this.label(this.screen,'把方块落好，把未知挖开。',0,titleY-43,14,C.muted,320);
    this.label(this.screen,'第一矿井   ·   目标 30 米',0,titleY-80,13,C.gold,300);
    const bottom=-this.h/2+this.safeBottom;
    this.button(this.screen,'start','开始下潜   ↓',0,bottom+(small?179:218),Math.min(294,this.contentWidth),58,()=>{
      if(!this.store.prefs.tutorialRead){this.tutorialStartsGame=true;this.page='tutorial';this.draw();}else this.newGame();
    },true);
    const half=(Math.min(294,this.contentWidth)-12)/2;
    this.button(this.screen,'help','玩法说明',-(half+12)/2,bottom+(small?113:150),half,48,()=>{this.tutorialStartsGame=false;this.page='tutorial';this.draw();});
    this.button(this.screen,'settings','设置',(half+12)/2,bottom+(small?113:150),half,48,()=>{this.returnPage='home';this.page='settings';this.draw();});
    const recordY=bottom+(small?57:84);
    this.label(this.screen,this.store.records.score.toLocaleString(),-74,recordY,21,C.text,140,'center',true);
    this.label(this.screen,this.store.records.bestMs?time(this.store.records.bestMs):`${this.store.records.depth} 米`,74,recordY,21,C.text,140,'center',true);
    this.label(this.screen,'本机最高分',-74,recordY-25,10,C.muted,140);this.label(this.screen,this.store.records.bestMs?'最快通关':'最深纪录',74,recordY-25,10,C.muted,140);
    this.label(this.screen,'v0.1.1  ·  本地试玩版',0,bottom+17,10,'#617087',300);
  }
  private drawTutorial():void{
    const top=this.h/2-this.safeTop,small=this.h<720;
    this.label(this.screen,'下井之前',0,top-65,29,C.text,300,'center',true);this.label(this.screen,'三件事，开始你的第一次探索',0,top-103,13,C.muted);
    const items=[['01','填满一行','移动、旋转方块，把缺口补齐。'],['02','清岩层，挖得更深','每清除一行岩层，就向下推进1米。'],['03','带回地下的宝藏','矿石随所在行一起收集，30米即通关。']];
    const spacing=small?111:139,start=top-(small?175:205);
    items.forEach((item,i)=>{
      const y=start-i*spacing,g=this.graphics(this.screen,'Tutorial '+i);
      this.rect(g,-this.contentWidth/2,y-40,this.contentWidth,84,'#141f31');this.label(this.screen,item[0],-this.contentWidth/2+30,y+15,12,C.gold,42);
      if(i===2)this.crystal(g,-this.contentWidth/2+30,y-17,11);else for(let n=0;n<3;n++)this.rect(g,-this.contentWidth/2+15+n*10,y-23,8,8,i?C.gold:C.teal);
      this.label(this.screen,item[1],30,y+17,16,C.text,this.contentWidth-100,'left',true);this.label(this.screen,item[2],30,y-15,12,C.muted,this.contentWidth-100,'left');
    });
    const bottom=-this.h/2+this.safeBottom;
    this.label(this.screen,'按住方向键连续移动 · 落底立即锁定',0,bottom+118,11,C.muted,330);
    this.button(this.screen,'tutorial-done',this.tutorialStartsGame?'明白了，出发':'返回首页',0,bottom+63,Math.min(294,this.contentWidth),54,()=>{this.store.prefs.tutorialRead=true;this.store.save();if(this.tutorialStartsGame)this.newGame();else{this.page='home';this.draw();}},true);
  }
  private drawSettings():void{
    const top=this.h/2-this.safeTop;
    this.label(this.screen,'探索设置',0,top-84,28,C.text,300,'center',true);this.label(this.screen,'设置保存在当前浏览器',0,top-124,13,C.muted);
    this.label(this.screen,'声音反馈',-30,top-205,17,C.text,230,'left',true);this.label(this.screen,'按钮、消行与矿石音效',-30,top-234,12,C.muted,230,'left');
    this.button(this.screen,'toggle-sound',this.store.prefs.sound?'开启':'关闭',this.contentWidth/2-38,top-216,70,46,()=>{this.store.prefs.sound=!this.store.prefs.sound;this.store.save();this.draw();},this.store.prefs.sound);
    this.label(this.screen,'减少动态效果',-30,top-300,17,C.text,230,'left',true);this.label(this.screen,'关闭粒子与强闪光，保留必要提示',-30,top-329,11,C.muted,230,'left');
    this.button(this.screen,'toggle-motion',this.store.prefs.reducedMotion?'开启':'关闭',this.contentWidth/2-38,top-310,70,46,()=>{this.store.prefs.reducedMotion=!this.store.prefs.reducedMotion;this.store.save();this.draw();},this.store.prefs.reducedMotion);
    this.label(this.screen,this.store.available?'成绩自动保存在本机，无需登录':'本机存储不可用，纪录可能无法保存',0,top-410,12,C.muted,330);
    this.button(this.screen,'settings-back','返回',0,-this.h/2+this.safeBottom+70,Math.min(294,this.contentWidth),54,()=>{this.page=this.returnPage;this.draw();},true);
  }
  private drawGame():void{
    const m=this.model!;const top=this.h/2-this.safeTop-24,bottom=-this.h/2+this.safeBottom+20;
    this.label(this.screen,'方块深掘',-this.contentWidth/2+80,top-10,23,C.text,160,'left',true);
    this.label(this.screen,'EXPEDITION 01',-this.contentWidth/2+80,top-37,9,C.muted,160,'left');
    this.button(this.screen,'pause','Ⅱ',this.contentWidth/2-23,top-16,46,44,()=>this.pause());
    this.hud.depth=this.label(this.screen,'',-this.contentWidth/2+72,top-81,27,C.gold,144,'left',true);
    this.hud.score=this.label(this.screen,'',this.contentWidth/2-68,top-69,18,C.text,136,'right',true);
    this.hud.ore=this.label(this.screen,'',this.contentWidth/2-73,top-96,11,C.muted,146,'right');
    this.boardTop=top-(this.h<720?122:141);
    const controlTop=bottom+135;
    this.cell=Math.floor(Math.min((this.contentWidth-70)/10,(this.boardTop-controlTop-23)/20)*2)/2;
    this.cell=Math.max(12,this.cell);this.boardWidth=this.cell*10;this.left=-this.boardWidth/2-23;
    this.frameG=this.graphics(this.screen,'Mine frame');
    const centerX=this.left+this.boardWidth/2,centerY=this.boardTop-this.cell*10;
    const clip=this.createNode(this.screen,'Board viewport',centerX,centerY,this.boardWidth,this.cell*20);
    clip.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    this.boardG=this.graphics(clip,'Board');this.boardG.node.setPosition(-centerX,-centerY);
    this.previewG=this.graphics(this.screen,'Previews');
    this.effectsG=this.graphics(this.screen,'Effects');
    const side=this.left+this.boardWidth+34;
    this.label(this.screen,'暂存',side,this.boardTop-5,10,C.muted,54);
    this.label(this.screen,'接下来',side,this.boardTop-(this.cell*20<280?84:103),10,C.muted,60);
    this.hud.stage=this.label(this.screen,m.stage.name,this.left+this.boardWidth/2,this.boardTop+17,11,C.teal,this.boardWidth);
    this.hud.clock=this.label(this.screen,'',side,this.boardTop-this.cell*20+21,10,C.muted,62);
    this.hud.toast=this.label(this.screen,'',this.left+this.boardWidth/2,this.boardTop-35,14,C.gold,this.boardWidth-8,'center',true);
    const buttonWidth=(this.contentWidth-24)/4,centers=[-1.5,-.5,.5,1.5];
    const inputActions:Action[]=['left','soft','right','rotate'];const text=['←','↓','→','↻'];
    inputActions.forEach((action,i)=>this.button(this.screen,action,text[i],centers[i]*(buttonWidth+8),bottom+108,buttonWidth,55,()=>{},false,action));
    const holdW=Math.round(this.contentWidth*.29),dropW=this.contentWidth-holdW-12;
    this.button(this.screen,'hold','暂存',-this.contentWidth/2+holdW/2,bottom+39,holdW,53,()=>{},false,'hold');
    this.button(this.screen,'drop','↓  落底',this.contentWidth/2-dropW/2,bottom+39,dropW,53,()=>{},true,'drop');
    this.label(this.screen,'清除岩层才会增加深度',0,bottom-3,10,'#75849a',300);
    this.refreshBoard();this.refreshHud();
    if(this.paused)this.drawPause();else if(this.countdown>0)this.drawCountdown();
  }
  private drawCountdown():void{
    const g=this.graphics(this.screen,'Countdown veil');this.rect(g,this.left,this.boardTop-this.cell*20,this.boardWidth,this.cell*20,C.bg,205);
    this.hud.count=this.label(this.screen,Math.ceil(this.countdown/1000).toString(),this.left+this.boardWidth/2,this.boardTop-this.cell*9,72,C.gold,this.boardWidth,'center',true);
    this.label(this.screen,'准备下潜',this.left+this.boardWidth/2,this.boardTop-this.cell*9-65,12,C.muted,this.boardWidth);
  }
  private drawPause():void{
    const g=this.graphics(this.screen,'Pause veil');this.rect(g,-this.w/2,-this.h/2,this.w,this.h,C.dark,238);
    if(this.confirmAction){
      this.label(this.screen,this.confirmAction==='home'?'返回地面？':'重新下潜？',0,105,27,C.text,300,'center',true);
      this.label(this.screen,'当前对局进度将结束',0,61,14,C.muted,300);
      this.button(this.screen,'confirm','确认',0,-7,260,54,()=>{if(this.confirmAction==='home'){this.confirmAction=null;this.model=null;this.page='home';this.paused=false;this.draw();}else{this.confirmAction=null;this.newGame();}},true);
      this.button(this.screen,'cancel','继续留在这里',0,-77,260,50,()=>{this.confirmAction=null;this.draw();});return;
    }
    this.label(this.screen,'矿灯暂歇',0,146,30,C.text,300,'center',true);this.label(this.screen,'进度停在这里，准备好再出发',0,103,13,C.muted,320);
    this.button(this.screen,'resume','继续探索',0,28,270,56,()=>this.resume(),true);
    this.button(this.screen,'restart','重新开始',0,-41,270,50,()=>{this.confirmAction='restart';this.draw();});
    this.button(this.screen,'pause-settings','设置',0,-105,270,48,()=>{this.returnPage='game';this.page='settings';this.draw();});
    this.button(this.screen,'back-home','返回首页',0,-169,270,48,()=>{this.confirmAction='home';this.draw();});
  }
  private drawResult():void{
    const m=this.model!,won=m.phase==='won',top=this.h/2-this.safeTop,bottom=-this.h/2+this.safeBottom,small=this.h<720;
    const compact=small?Math.min(1,(this.h-this.safeTop-this.safeBottom-200)/440):1;
    this.label(this.screen,won?'EXPEDITION COMPLETE':'EXPEDITION ENDED',0,top-55,10,C.muted,330);
    const hero=top-(small?143*compact:202),g=this.graphics(this.screen,'Result treasure');this.crystal(g,0,hero,won?38:27,won?C.teal:'#8f9eb5');
    this.label(this.screen,won?'抵达矿井深处':'这次先回地面',0,hero-85*compact,Math.max(24,29*compact),C.text,340,'center',true);
    this.label(this.screen,won?'30米的未知，已经被你点亮。':'整理好方块，再来一次。',0,hero-124*compact,13,C.muted,330);
    const statY=hero-(small?188*compact:203);
    this.label(this.screen,m.score.toLocaleString(),0,statY,Math.max(32,40*compact),C.gold,330,'center',true);
    this.label(this.screen,this.newRecord?'本机新纪录':'本次得分',0,statY-37*compact,11,this.newRecord?C.teal:C.muted,250);
    this.label(this.screen,`${m.depth} / 30 米`,-92,statY-89*compact,18,C.text,150,'center',true);this.label(this.screen,time(m.elapsedMs),92,statY-89*compact,18,C.text,150,'center',true);
    this.label(this.screen,'挖掘深度',-92,statY-117*compact,10,C.muted,150);this.label(this.screen,'探索用时',92,statY-117*compact,10,C.muted,150);
    const totals=this.level.rows.reduce((s,r)=>s+(r.cells.match(/[cx]/g)||[]).length,0);
    this.label(this.screen,`铜矿 ${m.copper}  ·  水晶 ${m.crystal}    /    本关矿石 ${totals}`,0,statY-(small?144*compact:160),12,C.muted,350);
    this.button(this.screen,'again','再下潜一次',0,bottom+121,Math.min(294,this.contentWidth),56,()=>this.newGame(),true);
    this.button(this.screen,'result-home','返回首页',0,bottom+53,Math.min(294,this.contentWidth),48,()=>{this.model=null;this.page='home';this.draw();});
    if(!this.store.available)this.label(this.screen,'纪录暂未保存，请检查浏览器存储设置',0,bottom+14,10,C.gold,340);
  }
  private newGame(seed?:number):void{
    this.holds.clear();this.model=new GameModel(this.level,seed??((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0));
    this.model.paused=true;this.countdown=3000;this.paused=false;this.confirmAction=null;this.settled=false;this.newRecord=false;
    this.lastStage=0;this.page='game';this.particles=[];this.riseMs=0;this.toast='';this.toastTime=0;this.draw();
  }
  private pause():void{
    this.holds.clear();if(this.page!=='game'||!this.model||this.model.phase==='won'||this.model.phase==='lost')return;
    this.paused=true;this.model.paused=true;this.draw();
  }
  private resume():void{
    if(this.page!=='game'||this.w>this.h)return;this.paused=false;this.confirmAction=null;this.countdown=3000;this.model!.paused=true;this.draw();
  }
  private press(id:string,action:Action):void{
    if(this.page!=='game'||this.paused||this.countdown>0||this.model?.phase!=='playing')return;
    if(this.holds.has(id))return;
    this.holds.set(id,{action,time:0,next:action==='soft'?this.level.tuning.softMs:this.level.tuning.dasMs,serial:++this.serial});
    this.action(action);
  }
  private action(action:Action):void{
    if(this.page!=='game'||this.paused||this.countdown>0)return;
    if(this.model?.act(action)){if(action!=='drop')this.sound(action==='hold'?'tap':'move');this.consumeEvents();}
  }
  update(deltaSeconds:number):void{
    if(this.page!=='game'||!this.model||this.paused||this.w>this.h)return;
    const dt=Math.min(deltaSeconds*1000,100);
    if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);if(this.hud.count)this.hud.count.string=Math.ceil(this.countdown/1000).toString();if(this.countdown===0){this.model.paused=false;this.holds.clear();this.draw();}return;}
    const directional=Array.from(this.holds.values()).filter(h=>h.action==='left'||h.action==='right').sort((a,b)=>b.serial-a.serial)[0];
    for(const held of this.holds.values()){
      if(!['left','right','soft'].includes(held.action)||this.model.phase!=='playing'||(held.action!=='soft'&&held!==directional))continue;
      held.time+=dt;let repeats=0;
      while(held.time>=held.next&&repeats++<4){this.action(held.action);held.next+=held.action==='soft'?this.level.tuning.softMs:this.level.tuning.arrMs;}
    }
    this.model.advance(dt);this.consumeEvents();if(this.page!=='game')return;
    this.toastTime=Math.max(0,this.toastTime-dt);this.refreshHud();
    const wasRising=this.riseMs>0;this.riseMs=Math.max(0,this.riseMs-dt);
    if(this.model.revision!==this.lastRevision||this.model.phase==='clearing'||wasRising)this.refreshBoard();
    this.drawParticles(dt/1000);
  }
  private consumeEvents():void{
    if(!this.model)return;
    for(const event of this.model.drainEvents()){
      if(event.type==='lock')this.sound('lock');
      if(event.type==='clear-start'){
        this.sound('clear');
        if(!this.store.prefs.reducedMotion)for(const row of event.rows||[])for(let i=0;i<18;i++){
          if(this.particles.length>95)break;
          this.particles.push({x:this.left+Math.random()*this.boardWidth,y:this.boardTop-(row-HIDDEN+.5)*this.cell,vx:(Math.random()-.5)*95,vy:Math.random()*70+20,life:.6,max:.6,color:i%3===0?C.gold:'#9aa8ba'});
        }
        if(!this.store.prefs.reducedMotion)for(const row of event.rows||[])this.model.board[row].cells.forEach((cell,x)=>{
          if(cell==='copper'||cell==='crystal')this.particles.push({x:this.left+(x+.5)*this.cell,y:this.boardTop-(row-HIDDEN+.5)*this.cell,vx:0,vy:0,life:.65,max:.65,color:cell==='crystal'?C.teal:C.gold,targetX:this.contentWidth/2-48,targetY:this.h/2-this.safeTop-120});
        });
      }
      if(event.type==='clear'){
        this.riseMs=this.store.prefs.reducedMotion?0:150;this.riseAmount=(event.replenished||0)*this.cell;
        this.toast=event.layers?`↓ ${event.layers} 米${event.lines!>1?'  ·  '+event.lines+'行消除':''}`:`${event.lines}行消除`;
        this.toastTime=1200;if(event.copper||event.crystal)this.sound('ore');
        const stage=this.level.stages.indexOf(this.model.stage);if(stage!==this.lastStage){this.lastStage=stage;this.toast='抵达 '+this.model.stage.name;this.toastTime=1800;this.sound('stage');}
      }
      if(event.type==='won'||event.type==='lost'){
        if(this.settled)continue;this.settled=true;this.holds.clear();
        this.newRecord=this.store.settle(this.model.score,this.model.depth,this.model.copper+this.model.crystal,this.model.elapsedMs,event.type==='won');
        this.sound(event.type==='won'?'win':'lose');this.page='result';this.draw();
      }
    }
  }
  private refreshHud():void{
    const m=this.model;if(!m)return;
    const set=(key:string,value:string)=>{if(this.hud[key]&&this.hud[key].string!==value)this.hud[key].string=value;};
    set('depth',`${m.depth.toString().padStart(2,'0')} / 30 m`);set('score',m.score.toLocaleString()+' 分');set('ore',`铜矿 ${m.copper}    水晶 ${m.crystal}`);set('clock',time(m.elapsedMs));set('stage',m.stage.name);set('toast',this.toastTime>0?this.toast:'');
  }
  private drawCell(g:Graphics,value:Cell,x:number,y:number,size:number,ghost=false):void{
    if(!value)return;
    if(ghost){g.strokeColor=color('#c2b28f',145);g.lineWidth=1.5;g.rect(x+2,y+2,size-4,size-4);g.stroke();return;}
    if(value==='rock'||value==='copper'||value==='crystal'){
      this.rect(g,x+1,y+1,size-2,size-2,'#354050');this.rect(g,x+2,y+size-4,size-4,2,'#515563');
      this.rect(g,x+size*.65,y+4,size*.23,2,'#242e40');this.rect(g,x+3,y+size*.45,size*.28,2,'#46505e');
      if(value==='copper'){this.rect(g,x+size*.28,y+size*.25,size*.26,size*.34,'#daaa6e');this.rect(g,x+size*.55,y+size*.48,size*.2,size*.23,'#f2ca88');}
      if(value==='crystal')this.crystal(g,x+size*.5,y+size*.5,size*.29);
    }else{
      const tint=PIECE[value];this.rect(g,x+1,y+1,size-2,size-2,tint);this.rect(g,x+2,y+size-4,size-4,2,'#ffffff',90);this.rect(g,x+2,y+2,size-4,2,'#0b1222',80);
      this.rect(g,x+size*.4,y+size*.4,Math.max(2,size*.2),Math.max(2,size*.2),'#ffffff',27);
    }
  }
  private refreshBoard():void{
    if(!this.model||!this.boardG||!this.previewG)return;const m=this.model,g=this.boardG;g.clear();this.lastRevision=m.revision;
    const bottom=this.boardTop-this.cell*20,fg=this.frameG!;fg.clear();
    this.rect(fg,this.left-6,bottom-6,this.boardWidth+12,this.cell*20+12,'#4e4943');this.rect(fg,this.left-4,bottom-4,this.boardWidth+8,this.cell*20+8,'#182235');
    this.rect(g,this.left,bottom,this.boardWidth,this.cell*20,C.dark);
    for(let y=0;y<20;y++)for(let x=0;x<10;x++)this.rect(g,this.left+x*this.cell+1,this.boardTop-(y+1)*this.cell+1,this.cell-2,this.cell-2,(x+y)%2?'#0e1726':'#101a2a');
    const shift=this.store.prefs.reducedMotion?0:this.riseAmount*Math.pow(this.riseMs/150,2);
    for(let y=HIDDEN;y<22;y++)for(let x=0;x<WIDTH;x++)this.drawCell(g,m.board[y].cells[x],this.left+x*this.cell,this.boardTop-(y-HIDDEN+1)*this.cell-shift,this.cell);
    const drawPiece=(p:ReturnType<GameModel['ghost']>,ghost=false)=>{if(!p)return;blocks(p.kind,p.rotation).forEach(([dx,dy])=>{const yy=p.y+dy-HIDDEN;if(yy>=0&&yy<20)this.drawCell(g,p.kind,this.left+(p.x+dx)*this.cell,this.boardTop-(yy+1)*this.cell,this.cell,ghost);});};
    drawPiece(m.ghost(),true);drawPiece(m.active);
    if(m.phase==='clearing')for(const row of m.pendingRows)this.rect(g,this.left,this.boardTop-(row-HIDDEN+1)*this.cell,this.boardWidth,this.cell,C.gold,this.store.prefs.reducedMotion?65:70+Math.round(90*Math.sin(m.clearClock/200*Math.PI)));
    for(let i=0;i<=20;i+=5){this.rect(fg,this.left-13,this.boardTop-i*this.cell-1,4,1,'#627085');}
    this.rect(fg,this.left,this.boardTop+8,this.boardWidth,2,'#263446');this.rect(fg,this.left,this.boardTop+8,this.boardWidth*Math.min(1,m.depth/30),2,C.teal);
    const pg=this.previewG;pg.clear();const side=this.left+this.boardWidth+34;
    this.rect(pg,side-24,this.boardTop-78,48,58,'#152034');
    const preview=(kind:PieceKind|null,cx:number,cy:number,size=10)=>{if(!kind){this.rect(pg,cx-7,cy-1,14,2,'#526077');return;}const pts=blocks(kind),minx=Math.min(...pts.map(p=>p[0])),maxx=Math.max(...pts.map(p=>p[0])),miny=Math.min(...pts.map(p=>p[1])),maxy=Math.max(...pts.map(p=>p[1]));for(const [x,y]of pts)this.drawCell(pg,kind,cx+(x-(minx+maxx+1)/2)*size,cy+((miny+maxy-1)/2-y)*size,size);};
    preview(m.held,side,this.boardTop-48);
    const compact=this.cell*20<350,tiny=this.cell*20<280,first=tiny?111:compact?137:149,spacing=tiny?35:compact?44:62,cardHeight=tiny?32:compact?40:52;
    for(let i=0;i<3;i++){const yy=this.boardTop-first-i*spacing;this.rect(pg,side-24,yy-cardHeight/2,48,cardHeight,i===0?'#1b293d':'#131d30');preview(m.queue[i],side,yy,tiny?(i===0?8:7):compact?(i===0?9:8):(i===0?10:9));}
    if(!m.canHold)this.rect(pg,side-24,this.boardTop-78,48,58,C.bg,130);
  }
  private drawParticles(dt:number):void{
    if(!this.effectsG)return;const g=this.effectsG;g.clear();if(this.store.prefs.reducedMotion){this.particles=[];return;}
    this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){
      p.life-=dt;
      if(p.targetX!==undefined&&p.targetY!==undefined){p.x+=(p.targetX-p.x)*Math.min(1,dt*8);p.y+=(p.targetY-p.y)*Math.min(1,dt*8);}
      else{p.vy-=125*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
      this.rect(g,p.x,p.y,p.targetX!==undefined?6:3,p.targetX!==undefined?6:3,p.color,Math.max(0,Math.round(255*p.life/p.max)));
    }
  }
  onDestroy():void{
    window.removeEventListener('resize',this.onResize);window.removeEventListener('blur',this.onHide);input.off(Input.EventType.KEY_DOWN,this.onKeyDown,this);input.off(Input.EventType.KEY_UP,this.onKeyUp,this);game.off(Game.EVENT_HIDE,this.onHide,this);if(this.resizeTimer)clearTimeout(this.resizeTimer);
  }
}
