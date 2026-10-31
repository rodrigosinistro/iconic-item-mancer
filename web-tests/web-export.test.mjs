import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeCatalog,newDraft,normalizeDraft,createFoundryItem,importItem,safeImage,itemDescription,randomId,WEB_ID} from '../docs/lib/web-core.mjs';
import {draftFromItem,totals,validateDraft} from '../docs/lib/rules.mjs';
const data=await Promise.all(['powers','origins','restrictions','special-powers'].map(async n=>JSON.parse(await readFile(new URL(`../docs/data/${n}.json`,import.meta.url),'utf8'))));
const catalog=makeCatalog(...data);
let next=0;const randomID=()=>`webtest${String(next++).padStart(9,'0')}`;
const power=name=>catalog.powers.find(p=>p.name===name);
function ready(type='weapon') {const d=newDraft();Object.assign(d,{name:'Égide de teste',description:'Proteção & história <marcante>.',itemType:type,originUuid:catalog.origins.find(o=>o.name==='High Tech').uuid,regularPowerUuids:[power('Sturdy 2').uuid],specialPowerIds:['bandaging'],restrictions:[{id:'unattached-carried',value:''}]});return d;}

test('real catalogs load with unique canonical IDs and complete Power snapshots',()=>{
 assert.equal(catalog.powers.length,398);assert.equal(catalog.origins.length,40);assert.equal(catalog.restrictions.length,39);assert.equal(catalog.specials.length,30);
 assert.equal(new Set(catalog.powers.map(p=>p.uuid)).size,398);
 for(const p of catalog.powers){assert.ok(p.source.system);assert.equal(p.source.type,'power');assert.ok(p.uuid.startsWith('Compendium.multiverse-d616.powers.Item.'));}
});
test('export round-trips through the module adapter and web importer with equal costs and settings',()=>{
 const d=ready();d.weaponDetails={...d.weaponDetails,primaryMode:'agl',activeMode:'agl',agilityRange:'25',agilityDamageMultiplierBonus:2};d.reliance={type:'tech',affected:'Sturdy 2'};
 const doc=createFoundryItem(d,catalog,{randomID});
 assert.equal(doc.type,'weapon');assert.equal(doc.system.attackTarget,'agl');assert.equal(doc.system.attackRange,25);assert.equal(doc.system.damageMultiplierBonus,'2');
 const moduleDraft=draftFromItem(doc);assert.equal(moduleDraft.name,d.name);assert.deepEqual(moduleDraft.restrictions,d.restrictions);assert.deepEqual(moduleDraft.reliance,d.reliance);assert.deepEqual(moduleDraft.weaponDetails,d.weaponDetails);
 const opened=importItem(JSON.parse(JSON.stringify(doc)),catalog);
 assert.deepEqual(totals(opened.draft,opened.catalog),totals(d,catalog));assert.deepEqual(opened.draft.visual,d.visual);assert.equal(validateDraft(opened.draft,opened.catalog).errors.length,0);
 const exportedAgain=createFoundryItem(opened.draft,opened.catalog,{randomID,existingDocument:opened.document});
 assert.deepEqual(exportedAgain.flags['multiverse-d616'].attachedPowers,doc.flags['multiverse-d616'].attachedPowers);
});
test('new regular and special attachments are independent type Power copies in native D616 flags',()=>{
 const d=ready('item');const doc=createFoundryItem(d,catalog,{randomID}),attached=doc.flags['multiverse-d616'].attachedPowers;
 assert.equal(attached.length,2);assert.ok(attached.every(e=>e.data.type==='power'));assert.ok(attached.some(e=>e.data.flags['iconic-item-mancer']?.specialId==='bandaging'));
 const r=attached.find(p=>p.name==='Sturdy 2');assert.deepEqual(r.data.system,power('Sturdy 2').source.system);r.data.system.description='Editado';assert.notEqual(power('Sturdy 2').source.system.description,'Editado');
 assert.equal(doc.flags['iconic-item-mancer'].powerPicks,3);assert.equal(doc.flags['iconic-item-mancer'].powerValue,2);
});
test('an imported Foundry item keeps edited power snapshots, manual attachments, worn state and foreign flags',()=>{
 const doc=createFoundryItem(ready('item'),catalog,{randomID});const f=doc.flags['iconic-item-mancer'];f.wornActive=false;doc.flags.customModule={setting:'preserve'};
 const attached=doc.flags['multiverse-d616'].attachedPowers;attached[0].data.system.cost='99';attached.push({id:randomID(),sourceUuid:'Item.manual',data:{type:'power',name:'Poder manual',system:{description:'Não gerenciado'}},name:'Poder manual'});
 const opened=importItem(doc,catalog);opened.draft.specialPowerIds=[];
 const updated=createFoundryItem(opened.draft,opened.catalog,{randomID,existingDocument:opened.document});const out=updated.flags['multiverse-d616'].attachedPowers;
 assert.equal(out.length,2);assert.equal(out[0].data.system.cost,'99');assert.ok(out.some(p=>p.sourceUuid==='Item.manual'));assert.equal(updated.flags['iconic-item-mancer'].wornActive,false);assert.deepEqual(updated.flags.customModule,{setting:'preserve'});
});
test('custom world powers and unknown origins can be imported without network lookups',()=>{
 const doc=createFoundryItem(ready(),catalog,{randomID});const f=doc.flags['iconic-item-mancer'];const uuid='Item.worldcustom';const entry=doc.flags['multiverse-d616'].attachedPowers[0];entry.sourceUuid=uuid;entry.name='Poder da mesa';entry.data.name=entry.name;f.powers.regular[0]={...f.powers.regular[0],uuid,name:entry.name};f.origin={uuid:'Item.customOrigin',name:'Origem da mesa'};
 const opened=importItem(doc,catalog);assert.ok(opened.catalog.powers.find(p=>p.uuid===uuid));assert.equal(opened.draft.originUuid,'Item.customOrigin');const out=createFoundryItem(opened.draft,opened.catalog,{randomID,existingDocument:doc});assert.equal(out.flags['multiverse-d616'].attachedPowers[0].name,'Poder da mesa');
});
test('changing a numbered tier drops only the formerly managed tier',()=>{
 const doc=createFoundryItem(ready(),catalog,{randomID});const opened=importItem(doc,catalog);opened.draft.regularPowerUuids=[power('Sturdy 4').uuid];const out=createFoundryItem(opened.draft,opened.catalog,{randomID,existingDocument:doc});const powers=out.flags['multiverse-d616'].attachedPowers;assert.equal(powers.filter(p=>p.sourceUuid===power('Sturdy 2').uuid).length,0);assert.equal(powers.filter(p=>p.sourceUuid===power('Sturdy 4').uuid).length,1);assert.equal(out.flags['iconic-item-mancer'].powerPicks,6);
});
test('Adamantium has the exact v14 effect once, and no effect is added to gear',()=>{
 const d=ready();d.specialPowerIds=['adamantium'];let doc=createFoundryItem(d,catalog,{randomID});assert.equal(doc.effects.length,1);assert.equal(doc.effects[0].system.changes[0].key,'flags.multiverse-d616.adamantiumHealthDrIgnore');doc=createFoundryItem(d,catalog,{randomID,existingDocument:doc});assert.equal(doc.effects.length,1);d.itemType='item';assert.equal(createFoundryItem(d,catalog,{randomID}).effects.length,0);
});
test('invalid drafts and incompatible options cannot export',()=>{
 const d=ready();d.name='';assert.throws(()=>createFoundryItem(d,catalog,{randomID}),/nome/);d.name='Teste';d.specialPowerIds=['constructable'];assert.throws(()=>createFoundryItem(d,catalog,{randomID}),/Constructable/);d.specialPowerIds=['stackable'];assert.throws(()=>createFoundryItem(d,catalog,{randomID}),/Stackable/);
});
test('unrecognized imports fail explicitly and HTML from narrative is escaped in item output',()=>{
 assert.throws(()=>importItem({type:'item',name:'Comum'},catalog),/Iconic Item/);const d=ready();d.description='<img src=x onerror=alert(1)> & story';const html=itemDescription(d,catalog);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&amp; story'));
});
test('image sources and restored visuals reject active content and malformed values',()=>{
 assert.equal(safeImage('javascript:alert(1)'), '');assert.equal(safeImage('data:text/html;base64,Zm9v'),'');assert.equal(safeImage('data:image/svg+xml;base64,Zm9v'),'');assert.equal(safeImage('https://example.com/a.png'),'https://example.com/a.png');assert.equal(safeImage('icons/a.webp'),'icons/a.webp');
 const d=normalizeDraft({name:'Teste',visual:{color:'red;position:fixed',glyph:'<script>'},specialPowerIds:['bandaging','bandaging']});assert.equal(d.visual.color,'#d83343');assert.equal(d.visual.glyph,'shield');assert.deepEqual(d.specialPowerIds,['bandaging']);
});

test('default IDs work without requiring the secure-origin randomUUID API',()=>{
 const ids=Array.from({length:30},()=>randomId());assert.equal(new Set(ids).size,30);assert.ok(ids.every(id=>/^[A-Za-z0-9]{16}$/.test(id)));
 const doc=createFoundryItem(ready(),catalog);assert.ok(doc.flags['multiverse-d616'].attachedPowers.every(p=>/^[A-Za-z0-9]{16}$/.test(p.id)));
});
