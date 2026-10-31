import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDraft,powerPickCost,powerFamilyKey,validateDraft,totals,weaponSystem,gearSystem,weaponModePatch,powerSnapshot,reconcileAttachedPowers,draftFromItem} from '../docs/lib/rules.mjs';
const catalog={origins:[{name:'High Tech',uuid:'Compendium.multiverse-d616.origins.Item.a'}],
 powers:[{name:'Flight 1',uuid:'Compendium.multiverse-d616.powers.Item.f1',powerSet:'Basic',numbered:1},
 {name:'Flight 3',uuid:'Compendium.multiverse-d616.powers.Item.f3',powerSet:'Basic',numbered:3},
 {name:'Venom Blast',uuid:'Compendium.multiverse-d616.powers.Item.v',powerSet:'Spider-Powers',numbered:0}],
 specials:[{id:'weapon',name:'Weapon'},{id:'stackable',name:'Stackable'},{id:'constructable',name:'Constructable'},{id:'adamantium',name:'Adamantium'}],
 restrictions:[{id:'use-once',category:'use',name:'Once per hour'},
 {id:'use-two',category:'use',name:'Another use'},
 {id:'obvious-loud',category:'obvious',name:'Loud'},
 {id:'obvious-flashy',category:'obvious',name:'Flashy'},
 {id:'access-min-rank',category:'access',name:'Rank required',hasValue:true,valueType:'number',min:2,max:6},
 {id:'unattached-worn',category:'unattached',name:'Worn'}]};
function ready(type='weapon') {const d=defaultDraft();d.itemType=type;d.name='Escudo';d.originUuid=catalog.origins[0].uuid;d.regularPowerUuids=[catalog.powers[1].uuid];return d;}
test('weapon adds one special pick and numbered tier costs its level',()=>{
 const d=ready();assert.equal(powerPickCost(catalog.powers[1]),3);assert.equal(totals(d,catalog).powerPicks,4);
 d.restrictions=[{id:'obvious-loud',value:''},{id:'obvious-flashy',value:''}];assert.equal(totals(d,catalog).powerValue,2);
 d.restrictions.push({id:'use-once',value:''});assert.equal(totals(d,catalog).powerValue,1);
});
test('equipment is not automatically Weapon, and a named special counts one',()=>{
 const d=ready('item');assert.equal(totals(d,catalog).powerPicks,3);
 d.specialPowerIds=['adamantium'];assert.equal(totals(d,catalog).powerPicks,4);
 assert.match(validateDraft(d,catalog).warnings.join(' '),/Adamantium/);
});
test('required and categorical restrictions are validated',()=>{
 const d=ready();d.restrictions=[{id:'use-once'},{id:'use-two'}];
 assert.match(validateDraft(d,catalog).errors.join(' '),/categoria/);
 d.restrictions=[{id:'access-min-rank',value:''}];assert.match(validateDraft(d,catalog).errors.join(' '),/Informe o parâmetro/);
 d.restrictions=[{id:'access-min-rank',value:'1'}];assert.match(validateDraft(d,catalog).errors.join(' '),/Valor inválido/);
 d.restrictions=[{id:'access-min-rank',value:'2'}];assert.equal(validateDraft(d,catalog).errors.length,0);
});
test('constructable cannot coexist with unattached and stackable requires target',()=>{
 const d=ready();d.restrictions=[{id:'unattached-worn'}];d.specialPowerIds=['constructable','stackable'];
 assert.match(validateDraft(d,catalog).errors.join(' '),/Constructable/);
 assert.match(validateDraft(d,catalog).errors.join(' '),/Stackable/);
 d.specialPowerIds=['stackable'];d.specialConfig.stackableTarget=catalog.powers[1].uuid;
 assert.equal(validateDraft(d,catalog).errors.length,0);
});
test('weapon fields use exact D616 schema primitives and modes',()=>{
 const d=ready(),melee=weaponSystem(d,'desc');assert.equal(melee.attackTarget,'mle');assert.equal(melee.attackKind,'close');
 d.weaponDetails.agilityRange='15 spaces';d.weaponDetails.agilityDamageMultiplierBonus=2;
 const agl=weaponModePatch(d,'agl');assert.equal(agl['system.attackRange'],15);assert.equal(agl['system.damageMultiplierBonus'],'2');
 assert.equal(gearSystem('gear').attack,false);
});
test('power snapshots have the system-native format and do not alias source',()=>{
 let next=1;
 const original={uuid:'Compendium.test.power.Item.a',toObject:()=>({name:'Power',img:'svg',type:'power',system:{powerSet:'Basic'},effects:[],flags:{}})};
 const item=powerSnapshot(original,()=>String(next++));
 assert.equal(item.sourceUuid,original.uuid);assert.equal(item.data.type,'power');
 assert.deepEqual(item.data.system,{powerSet:'Basic'});
});
test('preserves edits and manual attachments, only drops unchecked managed powers',()=>{
 const mk=(id,uuid,value)=>({id,sourceUuid:uuid,name:id,data:{type:'power',name:id,img:'icon',system:{element:value}}});
 const existing=[mk('managed1','u1','electricity'),mk('manual1','manual','fire')];
 const documents=new Map([['u2',{uuid:'u2',toObject:()=>({type:'power',name:'Power 2',system:{element:'ice'}})}]]);
 const updated=reconcileAttachedPowers(existing,['managed1'],['u2'],documents,()=> 'managed2');
 assert.equal(updated.list.length,2);assert.deepEqual(updated.managedPowerIds,['managed2']);
 assert.equal(updated.list.find(x=>x.id==='manual1').data.system.element,'fire');
 const retained=reconcileAttachedPowers(existing,['managed1'],['u1'],new Map(),()=> 'oops');
 assert.equal(retained.list.find(x=>x.id==='managed1').data.system.element,'electricity');
});
test('legacy Iconic Item can be reopened without changing item type, and tiers share a family',()=>{
 const source={name:'Old',type:'weapon',img:'some.svg',system:{},flags:{'iconic-item-mancer':{isIconicItem:true,origin:{uuid:'ori'},powers:{regular:[{uuid:'power1'}],special:[{id:'weapon'}]},restrictions:[{id:'use-once',value:''}]}}};
 const d=draftFromItem(source);assert.equal(d.itemType,'weapon');assert.deepEqual(d.specialPowerIds,[]);
 assert.equal(d.regularPowerUuids[0],'power1');assert.equal(powerFamilyKey(catalog.powers[0]),powerFamilyKey(catalog.powers[1]));
});

test('structured restriction fields round-trip without changing the saved text format', async()=>{
  const {parseRestrictionParts,formatRestrictionParts,RESTRICTION_PARTS}=await import('../docs/lib/rules.mjs');
  for(const [id,source,attribute,threshold] of [
    ['access-min-ability','Melee 4','Melee','4'],
    ['access-min-defense','Ego Defense 15','Ego Defense','15'],
    ['access-min-check','Logic non-combat +3','Logic','3']
  ]){
    const parts=parseRestrictionParts(id,source);
    assert.deepEqual(parts,{attribute,threshold});
    assert.equal(formatRestrictionParts(id,parts),source);
    assert.ok(RESTRICTION_PARTS[id].values.includes(attribute));
    assert.ok(Number(threshold)>=RESTRICTION_PARTS[id].min);
  }
  assert.equal(formatRestrictionParts('access-min-ability',{attribute:'Ego',threshold:''}),'');
  assert.equal(formatRestrictionParts('access-min-defense',{attribute:'',threshold:'15'}),'');
});
