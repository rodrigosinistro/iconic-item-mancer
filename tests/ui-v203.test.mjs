import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const callbacks={};
class FakeApp {
  constructor(){this.element=null;}
  async _prepareContext(){return {};}
  async _onRender(){}
  async render(){return this;}
}
globalThis.foundry={applications:{api:{ApplicationV2:FakeApp,HandlebarsApplicationMixin:Base=>Base}},utils:{randomID:()=> 'id'}};
globalThis.Hooks={once:(name,fn)=>callbacks[name]=fn,on:()=>{}};
globalThis.Handlebars={registerHelper:()=>{}};
globalThis.game={i18n:{lang:'pt-BR',localize:k=>k},system:{id:'multiverse-d616'}};
globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};
const {IconicItemMancer}=await import('../scripts/iconic-item-mancer.js');
const {RESTRICTION_PARTS,validateDraft}=await import('../scripts/rules.mjs');
callbacks.init();
const catalog={
  origins:[{uuid:'origin',name:'High Tech'}],
  powers:[{uuid:'p1',id:'p1',name:'Flight 3',numbered:3,powerSet:'Basic'}],
  specials:[{id:'weapon',name:'Weapon'}],
  restrictions:[
    {id:'access-min-ability',category:'access',namePtBR:'Habilidade mínima',hasValue:true,valueType:'text'},
    {id:'access-min-damage',category:'access',namePtBR:'Multiplicador mínimo',hasValue:true,valueType:'number',min:2,max:6},
    {id:'access-min-defense',category:'access',namePtBR:'Defesa mínima',hasValue:true,valueType:'text'},
    {id:'access-power',category:'access',namePtBR:'Poder necessário',hasValue:true,valueType:'text'}
  ]
};
test('limits ability score to 9 and damage multiplier to 6',async()=>{
  assert.equal(RESTRICTION_PARTS['access-min-ability'].max,9);
  const app=new IconicItemMancer();app.catalog=catalog;
  const ctx=await app._prepareContext({});
  const access=ctx.restrictionGroups.find(g=>g.id==='access').items;
  assert.equal(access.find(x=>x.id==='access-min-ability').partThresholds.at(-1).value,'9');
  assert.equal(access.find(x=>x.id==='access-min-damage').selectOptions.at(-1),'6');
  assert.equal(access.find(x=>x.id==='access-min-defense').longThreshold,true);
  const draft=app.draft;draft.name='T';draft.originUuid='origin';draft.regularPowerUuids=['p1'];
  draft.restrictions=[{id:'access-min-ability',value:'Melee 10'}];
  assert.match(validateDraft(draft,catalog).errors.join(','),/2 a 9/);
  draft.restrictions=[{id:'access-min-damage',value:'7'}];
  assert.match(validateDraft(draft,catalog).errors.join(','),/inválido/);
});
test('six steps: config after powers; review only last',async()=>{
  const app=new IconicItemMancer();app.catalog=catalog;
  Object.assign(app.draft,{name:'Escudo',originUuid:'origin',regularPowerUuids:['p1']});
  app.step=4;app.loadingPromise=Promise.resolve(catalog);
  const ctx=await app._prepareContext({});
  assert.deepEqual(ctx.steps.map(s=>s.label),['Básico','Origem','Restrições','Poderes','Configuração','Revisão']);
  const el={dataset:{iimAction:'next'},closest:(sel)=>sel==='[data-iim-action]'?el:null};
  await app._onClick({target:el,preventDefault(){}});
  assert.equal(app.step,5);
  await app._onClick({target:el,preventDefault(){}});
  assert.equal(app.step,6);
  await app._onClick({target:el,preventDefault(){}});
  assert.equal(app.step,6);
});
test('autocomplete search only displays matching suggestions within inner panel',()=>{
  const app=new IconicItemMancer();
  app.catalog={...catalog,powers:[...Array(150)].map((_,n)=>({name:`Power ${n+1}`}))};
  const list={hidden:true,scrollTop:13,replaceChildren(fragment){this.children=fragment.children;}};
  const wrap={querySelector:()=>list};
  const input={dataset:{iimAutocomplete:'access-power'},closest:()=>wrap,setAttribute(name,value){this[name]=value;}};
  globalThis.document={
    createDocumentFragment(){return {children:[],append(node){this.children.push(node);}};},
    createElement(tag){return {tag,dataset:{},textContent:'',className:''};}
  };
  app._renderSuggestions(input,'Power 14');
  assert.equal(list.hidden,false);
  assert.equal(input['aria-expanded'],'true');
  assert.equal(list.children.length,11);
  assert.ok(list.children.every(x=>x.dataset.iimSuggestion.includes('14')));
  app._renderSuggestions(input,'');
  assert.equal(list.children.length,150);
});
test('template and CSS keep long menus in scrollable cards and config outside powers',()=>{
  const path=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const template=readFileSync(resolve(path,'templates/wizard.hbs'),'utf8');
  const css=readFileSync(resolve(path,'styles/iconic-item-mancer.css'),'utf8');
  assert.doesNotMatch(template,/<datalist\b/i);
  assert.match(template,/class="iim-suggestion-list"/);
  assert.match(template,/class="iim-threshold-list"/);
  assert.match(css,/\.iim-app-shell \.iim-suggestion-list\s*\{[^}]*max-height:148px;[^}]*overflow-y:auto;/s);
  assert.match(css,/\.iim-app-shell \.iim-threshold-list\s*\{[^}]*max-height:145px;[^}]*overflow-y:auto;/s);
  const powers=template.split('{{#if step4}}')[1].split('{{#if step5}}')[0];
  const config=template.split('{{#if step5}}')[1].split('{{#if step6}}')[0];
  assert.doesNotMatch(powers,/Configuração de Arma|Iconic Reliance/);
  assert.match(config,/Configuração de Arma/);
  assert.match(config,/Iconic Reliance/);
  assert.match(template,/{{#if step6}}<button class="iim-btn create"/);
});
