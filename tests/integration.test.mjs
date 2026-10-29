import test from 'node:test';
import assert from 'node:assert/strict';
const callbacks={};
class FakeApp {
  constructor(){this.element=null;this.closed=false;}
  async _prepareContext(){return {};}
  _onRender(){}
  async close(){this.closed=true;}
  async render(){return this;}
}
globalThis.foundry={
  applications:{api:{ApplicationV2:FakeApp,HandlebarsApplicationMixin:base=>base}},
  utils:{randomID:()=>`rnd-${++globalThis.idCounter}`}
};
globalThis.idCounter=0;
globalThis.Hooks={once:(type,callback)=>callbacks[type]=callback,on:(type,callback)=>callbacks[type]=callback};
globalThis.Handlebars={registerHelper:()=>{}};
globalThis.game={system:{id:'multiverse-d616'},i18n:{lang:'pt-BR',localize:k=>k}};
globalThis.ui={notifications:{info:()=>{},error:msg=>{throw Error(msg);},warn:()=>{}}};
let created=[];
globalThis.Item={create:async data=>{created.push(data);return {name:data.name,type:data.type,effects:[],uuid:'Item.new',sheet:{render:()=>{}},createEmbeddedDocuments:async()=>{}};}};
globalThis.fromUuid=async uuid=>({uuid,type:'power',toObject:()=>({type:'power',name:'Flight 3',img:'flight.webp',system:{numbered:3,powerSet:'Basic',description:'Some rules'},effects:[],flags:{}})});
const {IconicItemMancer}=await import('../scripts/iconic-item-mancer.js');
callbacks.init();
const cat={origins:[{uuid:'origin1',name:'High Tech'}],powers:[{uuid:'power1',id:'p1',name:'Flight 3',numbered:3,powerSet:'Basic'}],
  specials:[{id:'weapon',name:'Weapon'}],restrictions:[]};
test('AppV2 wizard creates equipment with native attached powers in the actual Item payload',async()=>{
  created=[];
  const app=new IconicItemMancer();app.catalog=cat;
  Object.assign(app.draft,{name:'Escudo Teste',originUuid:'origin1',regularPowerUuids:['power1'],itemType:'weapon'});
  const ctx=await app._prepareContext({});assert.equal(ctx.powerValue,4);
  await app._save();
  assert.equal(created.length,1);
  const doc=created[0];
  assert.equal(doc.type,'weapon');assert.equal(doc.flags['iconic-item-mancer'].powerValue,4);
  assert.equal(doc.flags['multiverse-d616'].attachedPowers.length,1);
  assert.equal(doc.flags['multiverse-d616'].attachedPowers[0].data.system.numbered,3);
  assert.equal(doc.flags['iconic-item-mancer'].managedPowerIds.length,1);
  assert.ok(app.closed);
});
test('editing keeps associated power snapshots and manual attachments',async()=>{
  created=[];
  const power={id:'pA',sourceUuid:'power1',name:'Custom',img:'i',data:{type:'power',name:'Custom',img:'i',system:{element:'air'},flags:{},effects:[]}};
  const manual={id:'mB',sourceUuid:'manual',name:'Other',img:'i',data:{type:'power',name:'Other',img:'i',system:{element:'water'},flags:{},effects:[]}};
  let patch=null;
  const item={type:'item',name:'Amuleto',img:'i',uuid:'Item.amu',isOwner:true,system:{},
    flags:{'iconic-item-mancer':{isIconicItem:true,origin:{uuid:'origin1'},powers:{regular:[{uuid:'power1'}],special:[]},managedPowerIds:['pA'],wornActive:false},
      'multiverse-d616':{attachedPowers:[power,manual]}},
    update:async data=>{patch=data;},sheet:{render:()=>{}},effects:[]};
  const app=new IconicItemMancer({item});app.catalog=cat;
  await app._save();
  assert.equal(patch['flags.multiverse-d616.attachedPowers'].length,2);
  assert.equal(patch['flags.multiverse-d616.attachedPowers'][0].data.system.element,'air');
  assert.equal(patch['flags.multiverse-d616.attachedPowers'][1].data.system.element,'water');
  assert.equal(patch['flags.iconic-item-mancer'].wornActive,false,'a edição deve preservar estado Retirado');
});

test('two-dropdown ability/defense values are serialized and restored in wizard context',async()=>{
  const app=new IconicItemMancer();
  const ability={id:'access-min-ability',namePtBR:'Habilidade mínima',category:'access',hasValue:true,valueType:'text'};
  const defense={id:'access-min-defense',namePtBR:'Defesa mínima',category:'access',hasValue:true,valueType:'text'};
  const noncombat={id:'access-min-check',namePtBR:'Bônus mínimo',category:'access',hasValue:true,valueType:'text'};
  app.catalog={...cat,restrictions:[ability,defense,noncombat],specials:[{id:'weapon',name:'Weapon'},{id:'allspeak',name:'Allspeak',effectPtBR:'Entende qualquer idioma.'}]};
  app.draft.restrictions=[{id:ability.id,value:'Melee 4'}];
  const ctx=await app._prepareContext({});
  const access=ctx.restrictionGroups.find(g=>g.id==='access');
  const a=access.items.find(x=>x.id===ability.id);
  assert.equal(a.hasParts,true);
  assert.ok(a.partAttributes.some(x=>x.name==='Melee'&&x.selected));
  assert.ok(a.partThresholds.some(x=>x.value==='4'&&x.selected));
  assert.equal(access.items.find(x=>x.id===defense.id).partAttributes.length,6);
  assert.equal(access.items.find(x=>x.id===noncombat.id).partThresholds[0].value,'2');
  assert.equal(ctx.specialPowers.find(x=>x.id==='allspeak').displayEffect,'Entende qualquer idioma.');
  const control={dataset:{restrictionPartId:ability.id,restrictionPart:'threshold'},value:'5'};
  app._onChange({target:control});
  assert.equal(app.draft.restrictions[0].value,'Melee 5');
});


test('item description also includes selected iconic effect text',async()=>{
  created=[];
  const app=new IconicItemMancer();
  app.catalog={...cat,specials:[{id:'weapon',name:'Weapon',descriptionPtBR:'Arma.'},{id:'allspeak',name:'Allspeak',effectPtBR:'O portador entende qualquer idioma falado.'}]};
  Object.assign(app.draft,{name:'Amuleto de idiomas',originUuid:'origin1',regularPowerUuids:['power1'],itemType:'item',specialPowerIds:['allspeak']});
  await app._save();
  assert.match(created[0].system.description,/Efeito:.*qualquer idioma falado/);
});
