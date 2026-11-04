import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecordStore } from '../assets/scripts/services/RecordStore';
afterEach(()=>vi.unstubAllGlobals());
function fakeStorage(initial:string|null=null){let value=initial;vi.stubGlobal('localStorage',{getItem:()=>value,setItem:(_key:string,data:string)=>{value=data;}});}
describe('local records',()=>{
  it('preserves preferences and records across a new session',()=>{fakeStorage();const first=new RecordStore();first.prefs.sound=false;first.prefs.reducedMotion=true;first.settle(450,8,2,90000,false);const next=new RecordStore();expect(next.records.score).toBe(450);expect(next.prefs.sound).toBe(false);expect(next.prefs.reducedMotion).toBe(true);});
  it('only accepts completed games for the fastest time',()=>{fakeStorage();const store=new RecordStore();store.settle(100,10,0,1000,false);expect(store.records.bestMs).toBeNull();store.settle(6000,30,14,70000,true);store.settle(100,2,0,2000,false);expect(store.records.bestMs).toBe(70000);store.settle(6100,30,14,60000,true);expect(store.records.bestMs).toBe(60000);});
  it('falls back safely when storage throws',()=>{vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}});const store=new RecordStore();expect(()=>store.settle(100,1,0,1000,false)).not.toThrow();expect(store.available).toBe(false);expect(store.records.score).toBe(100);});
  it('rejects malformed or invalid stored values',()=>{fakeStorage('{broken');expect(()=>new RecordStore()).not.toThrow();fakeStorage(JSON.stringify({schema:1,records:{score:-2,depth:'30',minerals:Infinity,bestMs:0},prefs:{sound:'yes'}}));const store=new RecordStore();expect(store.records).toEqual({score:0,depth:0,minerals:0,bestMs:null});expect(store.prefs.sound).toBe(true);});
});
