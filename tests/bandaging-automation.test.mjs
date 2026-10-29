import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLEEDING, itemSpecialIds, itemUsable, findBandagingItem,
  hasBleeding, clearBleeding, primaryGM, cureWithBandaging,
  registerSpecialPowerAutomation,
} from '../scripts/special-power-automation.mjs';

const gameGM = {user:{id:'gm1',isGM:true},users:{activeGM:{id:'gm1'}},system:{id:'multiverse-d616'}};
const gamePlayer = {user:{id:'p1',isGM:false},users:{activeGM:{id:'gm1'}},system:{id:'multiverse-d616'}};
let serial=0;
const makeActor = ({bleeding=true,multi=false}={}) => {
  const actor={documentName:'Actor',uuid:`Actor.${++serial}`,name:'Garras',items:[],effects:[],statuses:new Set(),deletes:[],toggleCalls:[],
    async deleteEmbeddedDocuments(type,ids){
      assert.equal(type,'ActiveEffect');this.deletes.push(ids);
      this.effects=this.effects.filter(e=>!ids.includes(e.id));
      this.refreshStatuses();
    },
    async toggleStatusEffect(id,options){this.toggleCalls.push([id,options]);this.statuses.delete(id);},
    refreshStatuses(){this.statuses=new Set(this.effects.flatMap(e=>e.disabled?[]:[...e.statuses]));}
  };
  if(bleeding){
    const fx={id:`fx${serial}`,statuses:new Set(multi?[BLEEDING,'mmrpg.prone']:[BLEEDING]),disabled:false,
      async update(update){this.statuses=new Set(update.statuses);actor.refreshStatuses();}};
    actor.effects.push(fx);actor.refreshStatuses();
  }
  return actor;
};
const makeGear=(actor,{specials=['bandaging'],type='item',equipped=true,worn=true,wornRestriction=true,iconic=true}={})=>{
  const item={id:`item-${++serial}`,name:'Avengers Jacket',documentName:'Item',type,system:{equipped},parent:actor,
    flags:{'iconic-item-mancer':{isIconicItem:iconic,powers:{special:specials.map(id=>({id}))},
      restrictions:wornRestriction?[{id:'unattached-worn'}]:[],wornActive:worn}}};
  actor.items.push(item);return item;
};

test('identifies Bandaging only on owned iconic equipment, respecting worn and weapon equipped',()=>{
  const actor=makeActor();
  const jacket=makeGear(actor);
  assert.deepEqual(itemSpecialIds(jacket),['bandaging']);
  assert.equal(findBandagingItem(actor),jacket);
  delete jacket.flags['iconic-item-mancer'].wornActive;
  assert.equal(findBandagingItem(actor),jacket,'itens legados Worn contam como vestidos');
  jacket.flags['iconic-item-mancer'].wornActive=false;
  assert.equal(findBandagingItem(actor),null);
  jacket.flags['iconic-item-mancer'].wornActive=true;
  const weapon=makeGear(actor,{type:'weapon',equipped:false});
  assert.equal(itemUsable(weapon,actor),false);
  assert.equal(itemUsable(jacket,{uuid:'another'}),false);
  assert.equal(itemSpecialIds(makeGear(actor,{iconic:false})).length,0);
});

test('cures bleeding immediately without rolling, spending actions or modifying Health',async()=>{
  const actor=makeActor(),jacket=makeGear(actor);
  let result=[];
  assert.equal(hasBleeding(actor),true);
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM,onCured:async(a,item)=>result.push([a,item])}),true);
  assert.equal(hasBleeding(actor),false);
  assert.equal(actor.effects.length,0);
  assert.deepEqual(result,[[actor,jacket]]);
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM}),false);
});

test('does not affect a character without the item, with un-worn jacket, or on a player client',async()=>{
  const actor=makeActor(),item=makeGear(actor);
  assert.equal(primaryGM(gamePlayer),false);
  assert.equal(await cureWithBandaging(actor,{gameInstance:gamePlayer}),false);
  assert.equal(hasBleeding(actor),true);
  item.flags['iconic-item-mancer'].wornActive=false;
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM}),false);
  assert.equal(hasBleeding(actor),true);
  item.flags['iconic-item-mancer'].wornActive=true;
  actor.items=[];
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM}),false);
  assert.equal(hasBleeding(actor),true);
});

test('multi-status ActiveEffect retains the other conditions after Bandaging',async()=>{
  const actor=makeActor({multi:true});makeGear(actor);
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM}),true);
  assert.equal(actor.effects.length,1);
  assert.deepEqual([...actor.effects[0].statuses],['mmrpg.prone']);
  assert.equal(actor.deletes.length,0);
});

test('no bleed status is a no-op even if Bandaging is present',async()=>{
  const actor=makeActor({bleeding:false});makeGear(actor);
  assert.equal(await clearBleeding(actor),false);
  assert.equal(await cureWithBandaging(actor,{gameInstance:gameGM}),false);
});

test('new condition or newly owned item triggers same automatic result, including scene reload',async()=>{
  let callbackReady=null;
  const handlers=new Map();
  const hooks={on(name,fn){const list=handlers.get(name)||[];list.push(fn);handlers.set(name,list);},once(name,fn){if(name==='ready')callbackReady=fn;this.on(name,fn);}};
  const game={...gameGM,actors:[]};
  const messages=[];
  globalThis.ChatMessage={getSpeaker:()=>({alias:'Garras'}),create:async msg=>messages.push(msg)};
  globalThis.canvas={tokens:{placeables:[]}};
  registerSpecialPowerAutomation(hooks,game);
  const actor=makeActor();makeGear(actor);
  game.actors=[actor];
  callbackReady();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(hasBleeding(actor),false);
  assert.equal(messages.length,1);
  assert.match(messages[0].content,/Bandaging.*Avengers Jacket.*Sangrando removido/);
  assert.equal(messages[0].flags['iconic-item-mancer'].automation.specialId,'bandaging');
  // Also exercise post-condition hook with a fresh actor.
  const next=makeActor();makeGear(next);
  next.effects[0].parent=next;
  handlers.get('createActiveEffect')[0](next.effects[0]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(hasBleeding(next),false);
  const prior=makeActor();makeGear(prior);
  prior.items[0].parent=prior;
  handlers.get('updateItem')[0](prior.items[0]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(hasBleeding(prior),false);
  delete globalThis.ChatMessage;
  delete globalThis.canvas;
});

// Regressions for real Foundry v14 token/ActorDelta status ownership.
test('token-only bleeding is removed by the jacket without requiring an actor ActiveEffect',async()=>{
  const actor=makeActor({bleeding:false});makeGear(actor);
  const document={id:'token-1',effects:[BLEEDING],
    hasStatusEffect(id){return this.effects.includes(id);},
    async toggleStatusEffect(id,{active}){assert.equal(active,false);this.effects=this.effects.filter(e=>e!==id);}
  };
  const token={id:'token-1',actor,document};
  const canvasInstance={tokens:{placeables:[token]}};
  assert.equal(hasBleeding(actor,{token,canvasInstance}),true);
  const result=await cureWithBandaging(actor,{gameInstance:gameGM,token,canvasInstance});
  assert.equal(result,true);
  assert.equal(hasBleeding(actor,{token,canvasInstance}),false);
  assert.equal(document.effects.length,0);
});

test('actorTokens uses full UUID to avoid changing a different unlinked token actor',async()=>{
  const {actorTokens}=await import('../scripts/special-power-automation.mjs');
  const a1=makeActor({bleeding:false}),a2=makeActor({bleeding:false});
  a1.id='shared';a2.id='shared';
  const t1={actor:a1,document:{id:'a'}},t2={actor:a2,document:{id:'b'}};
  assert.deepEqual(actorTokens(a1,{tokens:{placeables:[t1,t2]}}),[t1]);
});

test('TokenDocument update hook finds synthetic Actor and clears token status',async()=>{
  const handlers=new Map();
  const hooks={on(n,f){const v=handlers.get(n)||[];v.push(f);handlers.set(n,v);},once(n,f){this.on(n,f);}};
  const actor=makeActor({bleeding:false});makeGear(actor);
  const tokenDoc={documentName:'Token',id:'token-2',actor,effects:[BLEEDING],
    hasStatusEffect(id){return this.effects.includes(id);},
    async toggleStatusEffect(id){this.effects=this.effects.filter(s=>s!==id);}
  };
  const token={id:'token-2',document:tokenDoc,actor};
  const priorCanvas=globalThis.canvas,priorChat=globalThis.ChatMessage;
  globalThis.canvas={tokens:{placeables:[token]}};
  globalThis.ChatMessage={getSpeaker:()=>({}),create:async()=>{}};
  try {
    registerSpecialPowerAutomation(hooks,{...gameGM,actors:[actor]});
    const result=handlers.get('updateToken')[0](tokenDoc,{effects:[BLEEDING]});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(tokenDoc.effects.length,0);
    assert.equal(result,undefined);
  }finally {globalThis.canvas=priorCanvas;globalThis.ChatMessage=priorChat;}
});

test('ActorDelta effect hook resolves its parent Token and synthetic Actor',async()=>{
  const {eventActor}=await import('../scripts/special-power-automation.mjs');
  const actor=makeActor({bleeding:false});
  const token={documentName:'Token',actor};
  const delta={documentName:'ActorDelta',parent:token};
  const effect={documentName:'ActiveEffect',parent:delta};
  assert.equal(eventActor(effect),actor);
});

test('diagnostic distinguishes wearing and bleeding states without modifying actors',async()=>{
  const {diagnoseBandaging}=await import('../scripts/special-power-automation.mjs');
  const actor=makeActor();const jacket=makeGear(actor);
  const before=actor.effects.length;
  let rows=diagnoseBandaging({gameInstance:{...gameGM,actors:[actor]},canvasInstance:{tokens:{placeables:[]}}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].canCure,true);
  jacket.flags['iconic-item-mancer'].wornActive=false;
  rows=diagnoseBandaging({gameInstance:{...gameGM,actors:[actor]},canvasInstance:{tokens:{placeables:[]}}});
  assert.equal(rows[0].canCure,false);
  assert.equal(actor.effects.length,before);
});

test('preCreate immediately prevents an isolated Bleeding condition for an equipped Bandaging item',async()=>{
  const events=new Map();
  const hooks={on(name,fn){events.set(name,fn);},once(name,fn){events.set(name,fn);}};
  const actor=makeActor({bleeding:false});makeGear(actor);
  const priorChat=globalThis.ChatMessage;
  const chat=[];
  globalThis.ChatMessage={getSpeaker:()=>({alias:'Garras'}),create:async data=>chat.push(data)};
  try{
    registerSpecialPowerAutomation(hooks,{...gameGM,actors:[actor]});
    const create=events.get('preCreateActiveEffect');
    assert.equal(typeof create,'function');
    const bleeding={documentName:'ActiveEffect',parent:actor,statuses:new Set([BLEEDING])};
    assert.equal(create(bleeding),false,'o sangramento deve ser vetado antes de ser salvo');
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(chat[0].content,/Sangramento impedido/);
    assert.equal(actor.effects.length,0);
    assert.equal(create({parent:actor,statuses:new Set(['mmrpg.prone'])}),undefined);
    assert.equal(create({parent:actor,statuses:new Set([BLEEDING,'mmrpg.prone'])}),undefined,
      'não devemos cancelar um efeito que também contém outras condições');
  }finally{globalThis.ChatMessage=priorChat;}
});

test('preCreate respects Worn state, item absence and primary GM authority',()=>{
  const handlers=new Map(),hooks={on(n,fn){handlers.set(n,fn);},once(n,fn){handlers.set(n,fn);}};
  const actor=makeActor({bleeding:false}),jacket=makeGear(actor);
  registerSpecialPowerAutomation(hooks,{...gamePlayer,actors:[actor]});
  const create=handlers.get('preCreateActiveEffect');
  assert.equal(create({parent:actor,statuses:[BLEEDING]}),undefined);
  registerSpecialPowerAutomation(hooks,{...gameGM,actors:[actor]});
  const gmCreate=handlers.get('preCreateActiveEffect');
  jacket.flags['iconic-item-mancer'].wornActive=false;
  assert.equal(gmCreate({parent:actor,statuses:[BLEEDING]}),undefined);
  actor.items=[];
  jacket.flags['iconic-item-mancer'].wornActive=true;
  assert.equal(gmCreate({parent:actor,statuses:[BLEEDING]}),undefined);
});

test('Bandaging recognizes an embedded item via actor inventory even when synthetic parent UUID differs',()=>{
  const actor=makeActor({bleeding:false});const jacket=makeGear(actor);
  jacket.parent={uuid:'Actor.actor-template',documentName:'Actor'};
  assert.equal(findBandagingItem(actor),jacket);
});

test('pending effects with _source statuses are detected before the Actor status list refreshes',async()=>{
  const {statusIds}=await import('../scripts/special-power-automation.mjs');
  assert.equal(statusIds({_source:{statuses:[BLEEDING]}}).has(BLEEDING),true);
});
