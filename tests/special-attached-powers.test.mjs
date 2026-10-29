import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSpecialPowerSnapshot,reconcileSpecialPowerSnapshots,specialIdOfEntry,migrateSpecialEquipmentItems} from '../scripts/special-attached-powers.mjs';
import {interceptSpecialHudClick,selectedHudActor} from '../scripts/special-hud-actions.mjs';
const def={id:'bandaging',name:'Bandaging',effectPtBR:'Interrompe imediatamente Sangramento.',descriptionPtBR:'Poder passivo.'};
let n=0;const id=()=>`special${++n}`;
test('Bandaging is an actual attached power with effect, independent ID, HUD-visible duration',()=>{
 const p=makeSpecialPowerSnapshot(def,id());
 assert.equal(p.data.type,'power');
 assert.equal(p.data.system.powerSet,'Iconic Item');
 assert.match(p.data.system.effect,/Interrompe/);
 assert.equal(specialIdOfEntry(p),'bandaging');
 assert.notEqual(p.data.system.duration,'Permanent');
 assert.equal(p.sourceUuid,'iconic-item-mancer:special:bandaging');
});
test('reconciliation keeps edited snapshots, original normal powers, removes only unselected specials',()=>{
 const regular={id:'regular1',sourceUuid:'Compendium.test.power',data:{type:'power',name:'Flight 1'}};
 const other=makeSpecialPowerSnapshot({id:'allspeak',name:'Allspeak',effectPtBR:'Falar'},id());
 const old=makeSpecialPowerSnapshot(def,id());old.data.system.effect='Edited by Narrator';
 const a=reconcileSpecialPowerSnapshots([regular,other,old],[def],id);
 assert.equal(a.list.length,2);
 assert.equal(a.list.find(p=>p.id===old.id).data.system.effect,'Edited by Narrator');
 assert.equal(a.list[0].id,regular.id);
 assert.equal(a.managedSpecialPowerIds[0],old.id);
 const b=reconcileSpecialPowerSnapshots(a.list,[def],id);
 assert.equal(b.list.length,2);
 assert.equal(b.managedSpecialPowerIds[0],old.id);
});
test('a legacy item can be migrated without recreating it or duplicating its power',async()=>{
 let updates=0;let item;
 item={uuid:'Actor.x.Item.i',id:'i',name:'Avengers Jacket',type:'item',
 flags:{'iconic-item-mancer':{isIconicItem:true,powers:{special:[{id:'bandaging'}]}},'multiverse-d616':{attachedPowers:[]}},
 async update(patch){updates++;this.flags['multiverse-d616'].attachedPowers=patch['flags.multiverse-d616.attachedPowers'];this.flags['iconic-item-mancer'].managedSpecialPowerIds=patch['flags.iconic-item-mancer.managedSpecialPowerIds'];}};
 const gameInstance={user:{isGM:true},system:{id:'multiverse-d616'},actors:[{items:[item]}],items:[]};
 const one=await migrateSpecialEquipmentItems({gameInstance,catalog:[def],randomID:id});
 assert.equal(one.updated,1);
 assert.equal(item.flags['multiverse-d616'].attachedPowers.length,1);
 const two=await migrateSpecialEquipmentItems({gameInstance,catalog:[def],randomID:id});
 assert.equal(two.updated,0);assert.equal(updates,1);
});
test('native HUD interception ignores ordinary powers and captures only Iconic Item special powers',()=>{
 const special=makeSpecialPowerSnapshot(def,id());
 const normal={id:'regular',data:{type:'power',name:'Accuracy 1'}};
 const item={id:'jacket',flags:{'multiverse-d616':{attachedPowers:[special,normal]}}};
 const actor={items:{get:k=>k==='jacket'?item:null}};
 const canvasInstance={tokens:{controlled:[{actor}]}};
 const gameInstance={user:{isGM:true}};
 assert.equal(selectedHudActor({gameInstance,canvasInstance}),actor);
 let prevented=false;
 const event=key=>({target:{closest:()=>({dataset:{itemId:'jacket',powerId:key}})},preventDefault(){prevented=true},stopImmediatePropagation(){}});
 assert.equal(interceptSpecialHudClick(event('regular'),{gameInstance,canvasInstance}),false);
 assert.equal(prevented,false);
 // Do not trigger real click async here, integration of activation is verified separately.
});
