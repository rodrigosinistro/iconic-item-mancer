/** Iconic Item Mancer 2.0.8 — Foundry VTT 14 / Multiverse-D616 0.2.99. */
import {
  VERSION, MODULE_ID, SYSTEM_ID, RESTRICTION_CATEGORIES, defaultDraft, clone, escapeHTML,
  powerPickCost, powerFamilyKey, selectedEntries, specialIds, totals, validateDraft,
  weaponSystem, gearSystem, weaponModePatch, draftFromItem, reconcileAttachedPowers,
  RESTRICTION_PARTS, parseRestrictionParts, formatRestrictionParts
} from './rules.mjs';
import {registerSpecialPowerAutomation,diagnoseBandaging,cureWithBandaging,itemSpecialIds} from './special-power-automation.mjs';
import {reconcileSpecialPowerSnapshots,migrateSpecialEquipmentItems} from './special-attached-powers.mjs';
import {registerSpecialHudHandlers,interceptSpecialSheetClick} from './special-hud-actions.mjs';

const base=`modules/${MODULE_ID}`;
const text=(key, fallback)=>{
  try { const translated=game.i18n.localize(`ICONICITEMMANCER.${key}`);return translated && translated!==`ICONICITEMMANCER.${key}`?translated:fallback; }
  catch { return fallback; }
};
const langName=entry=>game.i18n.lang==='pt-BR'?(entry.namePtBR||entry.name):(entry.name||entry.namePtBR);
const langDescription=entry=>game.i18n.lang==='pt-BR'?(entry.descriptionPtBR||entry.description):(entry.description||entry.descriptionPtBR);
const htmlElement=html=>html?.querySelector?html:html?.[0]?.querySelector?html[0]:null;
const idFn=()=>foundry.utils.randomID(16);
const ABILITIES=['Melee','Agility','Resilience','Vigilance','Ego','Logic'];
const MOVEMENT_MODES=['Flight','Gliding','Leaping','Swingline','Burrowing','Climbing','Wall-Crawling','Phasing','Teleport','Portal'];
const SIZES=['Tiny','Small','Average','Big','Huge'];
const SPECIES=['Human','Mutant','Alien','Android','Asgardian','Atlantean','Vampire'];
const TAGS=['Worthy','Heroic','Menacing','Anathema','Berserker','Bloodthirsty','Breathe Different'];
const TEAMS=['Avengers','X-Men','Fantastic Four','Guardians of the Galaxy','S.H.I.E.L.D.','Hydra'];
const TRAITS=['Anathema','Berserker','Bloodthirsty','Breathe Different','Extreme Appearance','Heroic','Menacing','Tech Reliance','Magic Reliance'];
const WEAKNESSES=['Fire','Cold','Electricity','Sonic','Magic','Mental'];
const rangeOptions=(min,max)=>Array.from({length:Math.max(0,max-min+1)},(_,i)=>String(min+i));
function uniqueSuggestions(list){ return [...new Set((list||[]).map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,game?.i18n?.lang||undefined,{numeric:true})); }
function restrictionFieldMeta(def,catalog){
  const meta={useSelect:false,selectOptions:[],suggestions:[],listId:`iim-suggest-${def.id}`,inputType:def.valueType==='number'?'number':'text'};
  switch(def.id){
    case 'access-min-damage': meta.useSelect=true; meta.selectOptions=rangeOptions(Number(def.min)||2, Math.min(6,Number(def.max)||6)); break;
    case 'access-min-rank': meta.useSelect=true; meta.selectOptions=rangeOptions(Number(def.min)||2, Number(def.max)||6); break;
    case 'access-movement': meta.suggestions=uniqueSuggestions(MOVEMENT_MODES); break;
    case 'access-origin': meta.suggestions=uniqueSuggestions((catalog.origins||[]).map(o=>o.name)); break;
    case 'access-power': meta.suggestions=uniqueSuggestions((catalog.powers||[]).map(p=>p.name)); break;
    case 'access-size': meta.suggestions=uniqueSuggestions(SIZES); break;
    case 'access-species': meta.suggestions=uniqueSuggestions(SPECIES); break;
    case 'access-tag': meta.suggestions=uniqueSuggestions(TAGS); break;
    case 'access-team': meta.suggestions=uniqueSuggestions(TEAMS); break;
    case 'access-trait': meta.suggestions=uniqueSuggestions(TRAITS); break;
    case 'challenging-weakness': meta.suggestions=uniqueSuggestions(WEAKNESSES); break;
    default: break;
  }
  return meta;
}
async function showPowerInfoDialog(title, subtitle, description){
  const safeSubtitle=subtitle?`<p class="iim-info-subtitle">${escapeHTML(subtitle)}</p>`:'';
  let body=String(description||'').trim();
  if(!body) body='<p class="iim-muted">Sem descrição disponível.</p>';
  else {
    try { body=await TextEditor.enrichHTML(body,{async:true}); }
    catch { body=`<p>${escapeHTML(body)}</p>`; }
  }
  const content=`<div class="iim-info-dialog">${safeSubtitle}<div class="iim-info-body">${body}</div></div>`;
  const DialogV2=foundry.applications?.api?.DialogV2;
  if(DialogV2){
    new DialogV2({window:{title},content,buttons:[{action:'ok',label:'Fechar',default:true}]}).render(true);
    return;
  }
  ui.notifications?.info?.(`${title}${subtitle?` — ${subtitle}`:''}`);
}

function powerFromIndex(entry, uuid) {
  return {id:entry._id||entry.id, uuid, name:entry.name||'Poder',img:entry.img||'',
    powerSet:String(entry.system?.powerSet||'Basic').trim()||'Basic',
    numbered:Number(entry.system?.numbered)||0,prerequisites:entry.system?.prerequisites||'',
    description:entry.system?.description||'',cost:entry.system?.cost||''};
}
function packFor(name) {
  return game.packs?.get(`${SYSTEM_ID}.${name}`)
    || game.packs?.find(p=>p.metadata?.packageName===SYSTEM_ID && p.metadata?.name===name);
}
async function readIndex(name,fields) {
  const pack=packFor(name);
  if (!pack) return [];
  const index=await pack.getIndex({fields});
  return Array.from(index.values()).map(entry=>({entry,uuid:`Compendium.${pack.collection}.Item.${entry._id}`}));
}
async function readCatalog() {
  async function readLocal(path) {
    const response=await fetch(`${base}/data/${path}`);
    if (!response.ok) throw new Error(`Falha ao carregar ${path} (${response.status})`);
    const json=await response.json();
    if (!Array.isArray(json)) throw new Error(`O catálogo ${path} não é uma lista.`);
    return json;
  }
  const [restrictions,specials,originsIndex,powersIndex]=await Promise.all([
    readLocal('restrictions.json'),readLocal('special-powers.json'),
    readIndex('origins',['system.description','img']),
    readIndex('powers',['system.powerSet','system.numbered','system.prerequisites','system.description','system.cost','img'])
  ]);
  const origins=originsIndex.map(({entry,uuid})=>({uuid,name:entry.name,img:entry.img||'',description:entry.system?.description||''}));
  const worldPowers=Array.from(game.items?.contents||[]).filter(i=>i.type==='power')
    .map(doc=>({entry:doc,uuid:doc.uuid}));
  // Compendium is the canonical source; World powers take precedence for duplicate names in the same set.
  const unique=new Map();
  for(const {entry,uuid} of [...powersIndex,...worldPowers]) {
    const power=powerFromIndex(entry,uuid);
    const key=powerFamilyKey(power)+`::${power.numbered||0}`;
    unique.set(key,power);
  }
  const powers=[...unique.values()].sort((a,b)=>a.powerSet.localeCompare(b.powerSet,game.i18n.lang)||a.name.localeCompare(b.name,game.i18n.lang,{numeric:true}));
  return {restrictions,specials,origins:origins.sort((a,b)=>a.name.localeCompare(b.name,game.i18n.lang)),powers};
}
function specialConfigSummary(power,draft,catalog){
  const c=draft.specialConfig||{};
  if (power.id==='reduced-focus'||power.id==='stackable') {
    const target=catalog.powers.find(p=>p.uuid===c[power.id==='stackable'?'stackableTarget':'reducedFocusTarget']);
    return target?`Poder: ${target.name}`:'';
  }
  if(power.id==='damage-switch') return `Dano: ${c.damageSwitch==='focus'?'Focus':'Health'}`;
  if(power.id==='effect-options') return `Efeitos: ${c.effectOptions||'—'}`;
  if(power.id==='negatite') return c.negatiteMode==='damage'?'+1 multiplicador de dano':'Ignora 10 de proteção';
  return '';
}
function describe(draft,catalog){
  const s=selectedEntries(draft,catalog),t=totals(draft,catalog),items=[];
  items.push('<section class="iim-item-description"><h2>Iconic Item</h2>');
  if(draft.description) items.push(`<p>${escapeHTML(draft.description).replaceAll('\n','<br>')}</p>`);
  items.push(`<p><strong>Origin:</strong> ${escapeHTML(s.origin?.name||'—')}</p>`);
  items.push('<h3>Powers</h3><ul>');
  for(const p of s.powers) items.push(`<li>@UUID[${p.uuid}]{${escapeHTML(p.name)}} <small>(${powerPickCost(p)} pick${powerPickCost(p)===1?'':'s'})</small></li>`);
  for(const p of s.specials){
    const effect=game.i18n.lang==='pt-BR'?(p.effectPtBR||langDescription(p)):(p.effect||langDescription(p));
    const config=specialConfigSummary(p,draft,catalog);
    items.push(`<li><strong>${escapeHTML(langName(p))}</strong>${config?` — ${escapeHTML(config)}`:''}${effect?`<div><small><b>Efeito:</b> ${escapeHTML(effect)}</small></div>`:''}</li>`);
  }
  items.push('</ul>');
  if(draft.itemType==='weapon') {
    const w=draft.weaponDetails;
    items.push(`<h3>Weapon</h3><p><b>Melee:</b> ${escapeHTML(w.meleeRange)} / DMB ${Number(w.meleeDamageMultiplierBonus)||0}<br><b>Agility:</b> ${escapeHTML(w.agilityRange)} / DMB ${Number(w.agilityDamageMultiplierBonus)||0}</p>`);
  }
  if(s.restrictions.length){
    items.push('<h3>Restrictions</h3><ul>');
    for(const r of s.restrictions) items.push(`<li><strong>${escapeHTML(langName(r))}</strong>${r.value?`: ${escapeHTML(r.value)}`:''}</li>`);
    items.push('</ul>');
  }
  if(draft.reliance.type!=='none') items.push(`<p><strong>${draft.reliance.type==='tech'?'Tech Reliance':'Magic Item Reliance'}:</strong> ${escapeHTML(draft.reliance.affected||'Conforme o Narrador')}</p>`);
  items.push(`<hr><p><b>Power Picks: ${t.powerPicks}</b> · Restrictions: ${t.restrictionCount} · <b>Power Value: ${t.powerValue}</b></p>`);
  items.push('</section>');
  return items.join('\n');
}

class IconicItemMancer extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:'iconic-item-mancer-app',classes:['iconic-item-mancer','mmc-app'],tag:'div',
    window:{frame:true,positioned:true,title:'Marvel Multiverse — Iconic Item Mancer',icon:'fa-solid fa-gem',resizable:true,minimizable:true},
    position:{width:1100,height:700}
  };
  static PARTS={wizard:{template:`${base}/templates/wizard.hbs`}};

  constructor({item=null,...options}={}) {
    super(options);
    this.editItem=item;
    this.draft=item?draftFromItem(item):defaultDraft();
    this.step=1;
    this.catalog={powers:[],specials:[],restrictions:[],origins:[]};
    this.loadingPromise=null;
    this.filter={query:'',set:''};
    this.scroll=0;
    this.panelScroll={regular:0,special:0};
    this.restrictionParts=new Map();
    this.busy=false;
  }
  async _ensureCatalog(){
    if(this.loadingPromise)return this.loadingPromise;
    this.loadingPromise=readCatalog().then(async c=>{
      // An older Iconic Item may reference a compendium Power that a World
      // override displaced in the deduplicated catalog. Keep the saved UUID.
      const missingPowers=(this.draft.regularPowerUuids||[]).filter(uuid=>!c.powers.some(p=>p.uuid===uuid));
      for(const uuid of missingPowers){
        try {const doc=await fromUuid(uuid);if(doc?.type==='power')c.powers.push(powerFromIndex(doc,uuid));}
        catch(error){console.warn(`${MODULE_ID} | Poder legado indisponível: ${uuid}`,error);}
      }
      if(this.draft.originUuid&&!c.origins.some(o=>o.uuid===this.draft.originUuid)){
        try {const origin=await fromUuid(this.draft.originUuid);if(origin?.type==='origin')c.origins.push({uuid:origin.uuid,name:origin.name,description:origin.system?.description||''});}
        catch(error){console.warn(`${MODULE_ID} | Origem legada indisponível`,error);}
      }
      this.catalog=c;return c;
    }).catch(error=>{
      this.loadingPromise=null;console.error(`${MODULE_ID} | Catálogos indisponíveis`,error);throw error;
    });
    return this.loadingPromise;
  }
  async render(force,options){
    try{await this._ensureCatalog();}
    catch(e){ui.notifications?.error?.(`Iconic Item Mancer: ${e.message}`);return this;}
    return super.render(force,options);
  }
  async _prepareContext(options){
    const context=await super._prepareContext(options),draft=this.draft,catalog=this.catalog;
    const selection=selectedEntries(draft,catalog),total=totals(draft,catalog);
    const regularSelected=new Set(draft.regularPowerUuids),specialSelected=new Set(specialIds(draft));
    const restrictionSelected=new Map(draft.restrictions.map(r=>[r.id,r]));
    Object.assign(context,{
      data:draft,editMode:!!this.editItem,step1:this.step===1,step2:this.step===2,step3:this.step===3,step4:this.step===4,step5:this.step===5,step6:this.step===6,
      powerPicks:total.powerPicks,restrictionCount:total.restrictionCount,powerValue:total.powerValue,
      validation:validateDraft(draft,catalog),showWeapon:draft.itemType==='weapon',selectedOrigin:selection.origin,
      steps:['Básico','Origem','Restrições','Poderes','Configuração','Revisão'].map((label,i)=>({label,n:i+1,active:this.step===i+1,completed:this.step>i+1})),
      origins:catalog.origins.map(o=>({...o,selected:draft.originUuid===o.uuid})),
      restrictionGroups:RESTRICTION_CATEGORIES.map(group=>({...group,items:catalog.restrictions.filter(r=>r.category===group.id).map(r=>{
        const ui=restrictionFieldMeta(r,catalog);
        const value=restrictionSelected.get(r.id)?.value||'';
        const config=RESTRICTION_PARTS[r.id];
        const parts=this.restrictionParts.get(r.id)||parseRestrictionParts(r.id,value);
        return {...r,displayName:langName(r),displayDescription:langDescription(r),selected:restrictionSelected.has(r.id),
          value,inputType:ui.inputType,useSelect:ui.useSelect,selectOptions:ui.selectOptions,
          suggestions:ui.suggestions,listId:ui.suggestions.length?ui.listId:'',
          hasParts:!!config,partLabel:config?.label||'',
          partAttributes:(config?.values||[]).map(name=>({name,selected:name===parts.attribute})),
          partThresholds:config?rangeOptions(config.min,config.max).map(n=>({value:n,selected:n===parts.threshold})):[],
          longThreshold:!!config && (config.max-config.min)>10,
          selectedThreshold:parts.threshold||'Valor...'
        };
      })})),
      powerSets:[...new Set(catalog.powers.map(p=>p.powerSet))],
      regularPowers:catalog.powers.map(p=>({...p,pickCost:powerPickCost(p),selected:regularSelected.has(p.uuid),displayDescription:p.description||'',
        searchText:`${p.name} ${p.powerSet} ${p.prerequisites}`.toLocaleLowerCase(),
        isVisible:(!this.filter.query||`${p.name} ${p.powerSet} ${p.prerequisites}`.toLocaleLowerCase().includes(this.filter.query)) && (!this.filter.set||p.powerSet===this.filter.set)
      })),
      specialPowers:catalog.specials.filter(p=>p.id!=='weapon').map(p=>({...p,displayName:langName(p),displayDescription:langDescription(p),
        displayEffect:game.i18n.lang==='pt-BR'?(p.effectPtBR||p.descriptionPtBR||p.description):(p.effect||p.description||p.effectPtBR),
        selected:specialSelected.has(p.id)})),
      selectedRegularPowers:selection.powers.map(p=>({...p,pickCost:powerPickCost(p)})),
      selectedSpecialPowers:selection.specials.map(p=>({...p,displayName:langName(p),detail:specialConfigSummary(p,draft,catalog)})),
      selectedRestrictions:selection.restrictions.map(r=>({...r,displayName:langName(r)})),
      numberedSelectedPowers:selection.powers.filter(p=>p.numbered>0),
      showReducedFocus:specialSelected.has('reduced-focus'),showStackable:specialSelected.has('stackable'),
      showEffectOptions:specialSelected.has('effect-options'),showDamageSwitch:specialSelected.has('damage-switch'),
      showNegatite:specialSelected.has('negatite'),
      searchQuery:this.filter.query,selectedPowerSet:this.filter.set
    });
    return context;
  }
  async _onRender(context,options){
    await super._onRender(context,options);
    const root=this.element?.querySelector('.iim-app-shell');
    if(!root)return;
    const scroll=root.querySelector('.iim-step-area');
    if(scroll)scroll.scrollTop=this.scroll;
    const regular=root.querySelector('[data-iim-scroll=regular]');
    const special=root.querySelector('[data-iim-scroll=special]');
    if(regular)regular.scrollTop=this.panelScroll.regular||0;
    if(special)special.scrollTop=this.panelScroll.special||0;
    root.addEventListener('click',event=>this._onClick(event));
    root.addEventListener('change',event=>this._onChange(event));
    root.addEventListener('input',event=>this._onInput(event));
    root.addEventListener('focusin',event=>this._onFocusIn(event));
    root.addEventListener('focusout',event=>this._onFocusOut(event));
    root.addEventListener('keydown',event=>this._onKeydown(event));
    if(this.step===4){
      const select=root.querySelector('#iim-powerset-filter');if(select)select.value=this.filter.set;
      this._filterPowerList(root);
    }
  }
  _captureScrollState(){
    this.scroll=this.element?.querySelector('.iim-step-area')?.scrollTop||0;
    this.panelScroll.regular=this.element?.querySelector('[data-iim-scroll=regular]')?.scrollTop||0;
    this.panelScroll.special=this.element?.querySelector('[data-iim-scroll=special]')?.scrollTop||0;
  }
  _rerender(){this._captureScrollState();return this.render(true);}
  _bindField(el){
    const path=el.dataset.bind;if(!path)return;
    const pieces=path.split('.');
    if(!/^(name|description|image|itemType|originUuid|narratorOverride|specialConfig|weaponDetails|reliance)$/.test(pieces[0]))return;
    let dest=this.draft;
    for(const key of pieces.slice(0,-1)){dest=dest?.[key];if(!dest)return;}
    const key=pieces.at(-1);
    dest[key]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?0:Number(el.value)):el.value;
  }
  _onInput(event){
    const el=event.target;
    if(el.dataset.bind){this._bindField(el);this._updateTotal();}
    if(el.id==='iim-power-search'){
      this.filter.query=el.value.trim().toLocaleLowerCase();this._filterPowerList(el.closest('.iim-app-shell'));
    }
    if(el.dataset.restrictionValue){
      const selected=this.draft.restrictions.find(r=>r.id===el.dataset.restrictionValue);
      if(selected)selected.value=el.value;
      if(el.dataset.iimAutocomplete)this._renderSuggestions(el,el.value);
    }
  }
  _hideSuggestions(except=null){
    this.element?.querySelectorAll('.iim-suggestion-list').forEach(list=>{
      if(list!==except){list.hidden=true;list.replaceChildren();}
    });
  }
  _renderSuggestions(input,query=''){
    const wrap=input.closest('.iim-restriction-input-wrap');
    const list=wrap?.querySelector('.iim-suggestion-list');
    if(!list)return;
    this._hideSuggestions(list);
    const field=this.catalog.restrictions.find(r=>r.id===input.dataset.iimAutocomplete);
    const options=restrictionFieldMeta(field||{},this.catalog).suggestions;
    const term=String(query||'').trim().toLocaleLowerCase();
    const matches=term?options.filter(o=>o.toLocaleLowerCase().includes(term)):options;
    const fragment=document.createDocumentFragment();
    for(const name of matches){
      const btn=document.createElement('button');btn.type='button';btn.className='iim-suggestion-item';
      btn.dataset.iimSuggestion=name;btn.textContent=name;fragment.append(btn);
    }
    if(matches.length===0){
      const note=document.createElement('div');note.className='iim-suggestion-empty';
      note.textContent='Nenhuma sugestão. Você pode digitar um valor personalizado.';fragment.append(note);
    }
    list.replaceChildren(fragment);list.hidden=false;list.scrollTop=0;
    input.setAttribute('aria-expanded','true');
  }
  _onFocusIn(event){
    const el=event.target;
    if(el?.dataset?.iimAutocomplete){this._renderSuggestions(el,el.value);} 
  }
  _onFocusOut(event){
    const wrap=event.target.closest?.('.iim-restriction-input-wrap');
    if(wrap && event.relatedTarget && !wrap.contains(event.relatedTarget)){
      const list=wrap.querySelector('.iim-suggestion-list');
      if(list)list.hidden=true;
      const input=wrap.querySelector('[data-iim-autocomplete]');
      input?.setAttribute('aria-expanded','false');
    }
    const dropdown=event.target.closest?.('.iim-compact-dropdown');
    if(dropdown&&event.relatedTarget&&!dropdown.contains(event.relatedTarget))this._hideDropdowns();
  }
  _onKeydown(event){
    const el=event.target;
    if(!el?.dataset?.iimAutocomplete)return;
    const wrap=el.closest('.iim-restriction-input-wrap');
    const list=wrap?.querySelector('.iim-suggestion-list');
    if(!list || list.hidden)return;
    const buttons=[...list.querySelectorAll('button[data-iim-suggestion]')];
    if(event.key==='Escape'){
      event.preventDefault();list.hidden=true;el.setAttribute('aria-expanded','false');return;
    }
    if(!buttons.length)return;
    const previous=buttons.findIndex(button=>button.classList.contains('active'));
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='ArrowDown'?(previous+1)%buttons.length:(previous<=0?buttons.length-1:previous-1);
      buttons.forEach(b=>b.classList.remove('active'));
      buttons[next].classList.add('active');buttons[next].scrollIntoView({block:'nearest'});
    } else if(event.key==='Enter'){
      event.preventDefault();this._chooseSuggestion(buttons[previous>=0?previous:0]);
    }
  }
  _chooseSuggestion(option){
    const wrap=option.closest('.iim-restriction-input-wrap');
    const input=wrap?.querySelector('input[data-iim-autocomplete]');
    if(!input)return;
    const value=option.dataset.iimSuggestion;
    input.value=value;
    const selected=this.draft.restrictions.find(r=>r.id===input.dataset.restrictionValue);
    if(selected)selected.value=value;
    const list=wrap.querySelector('.iim-suggestion-list');
    if(list){list.hidden=true;list.replaceChildren();}
    input.setAttribute('aria-expanded','false');
  }
  _onChange(event){
    const el=event.target;
    if(el.dataset.bind){
      this._bindField(el);
      if(el.dataset.bind==='weaponDetails.primaryMode')this.draft.weaponDetails.activeMode=el.value;
      if(['itemType','originUuid'].includes(el.dataset.bind))return void this._rerender();
    }
    if(el.id==='iim-powerset-filter'){
      this.filter.set=el.value;this._filterPowerList(el.closest('.iim-app-shell'));
    }
    if(el.dataset.restrictionPartId){
      const id=el.dataset.restrictionPartId;
      const selected=this.draft.restrictions.find(r=>r.id===id);
      if(selected){
        const parts={...(this.restrictionParts.get(id)||parseRestrictionParts(id,selected.value))};
        parts[el.dataset.restrictionPart]=el.value;
        this.restrictionParts.set(id,parts);
        selected.value=formatRestrictionParts(id,parts);
      }
      return;
    }
    if(el.dataset.restrictionValue){
      const selected=this.draft.restrictions.find(r=>r.id===el.dataset.restrictionValue);
      if(selected)selected.value=el.value;
      this._updateTotal();
      return;
    }
    if(el.dataset.restrictionId){this._toggleRestriction(el);return;}
    if(el.dataset.powerUuid){this._toggleRegularPower(el);return;}
    if(el.dataset.specialId){this._toggleSpecialPower(el);return;}
  }
  _toggleRestriction(el){
    const id=el.dataset.restrictionId;
    const def=this.catalog.restrictions.find(r=>r.id===id);if(!def)return;
    if(!el.checked){this.draft.restrictions=this.draft.restrictions.filter(r=>r.id!==id);this.restrictionParts.delete(id);}
    else {
      if(def.category==='unattached'&&this.draft.specialPowerIds.includes('constructable')){
        ui.notifications?.warn?.('Constructable é incompatível com Unattached.');el.checked=false;return;
      }
      if(!this.draft.narratorOverride&&this.draft.restrictions.length>=3&&!(def.category!=='obvious'&&this.draft.restrictions.some(r=>this.catalog.restrictions.find(d=>d.id===r.id)?.category===def.category))){
        ui.notifications?.warn?.('Limite de três restrições.');el.checked=false;return;
      }
      if(def.category!=='obvious'){
        const removed=this.draft.restrictions.filter(r=>this.catalog.restrictions.find(x=>x.id===r.id)?.category===def.category);
        for(const entry of removed)this.restrictionParts.delete(entry.id);
        this.draft.restrictions=this.draft.restrictions.filter(r=>this.catalog.restrictions.find(x=>x.id===r.id)?.category!==def.category);
      }
      this.draft.restrictions.push({id,value:''});
    }
    this._rerender();
  }
  _toggleRegularPower(el){
    const uuid=el.dataset.powerUuid,def=this.catalog.powers.find(p=>p.uuid===uuid);if(!def)return;
    let selected=this.draft.regularPowerUuids.filter(u=>u!==uuid);
    if(el.checked){
      // Numbered series are alternatives: selecting Flight 3 replaces Flight 1 / 2.
      const family=powerFamilyKey(def);
      selected=selected.filter(u=>{
        const p=this.catalog.powers.find(x=>x.uuid===u);
        return !p || p.numbered<=0 || def.numbered<=0 || powerFamilyKey(p)!==family;
      });
      selected.push(uuid);
    }
    this.draft.regularPowerUuids=selected;
    for(const key of ['stackableTarget','reducedFocusTarget'])if(!selected.includes(this.draft.specialConfig[key]))this.draft.specialConfig[key]='';
    this._rerender();
  }
  _toggleSpecialPower(el){
    const id=el.dataset.specialId,selected=new Set(this.draft.specialPowerIds);
    if(el.checked){
      if(id==='constructable'&&this.draft.restrictions.some(r=>this.catalog.restrictions.find(x=>x.id===r.id)?.category==='unattached')){
        ui.notifications?.warn?.('Constructable é incompatível com Unattached.');el.checked=false;return;
      }
      selected.add(id);
    } else selected.delete(id);
    this.draft.specialPowerIds=[...selected];
    this._rerender();
  }
  _filterPowerList(root){
    if(!root)return;
    for(const row of root.querySelectorAll('.iim-regular-power-row')){
      const text=String(row.dataset.search||'');
      row.hidden=!!((this.filter.query&&!text.includes(this.filter.query))||(this.filter.set&&row.dataset.powerset!==this.filter.set));
    }
  }
  _updateTotal(){
    const t=totals(this.draft,this.catalog),root=this.element;
    for(const [key,value] of [['power-value',t.powerValue],['power-picks',t.powerPicks],['restriction-count',t.restrictionCount]])
      root?.querySelectorAll(`[data-iim-${key}]`).forEach(el=>el.textContent=String(value));
  }
  _validStep(){
    if(this.step===1&&!this.draft.name.trim()){ui.notifications?.warn?.('Informe o nome do item.');return false;}
    if(this.step===2&&!selectedEntries(this.draft,this.catalog).origin){ui.notifications?.warn?.('Escolha uma origem.');return false;}
    if(this.step===4){
      const s=selectedEntries(this.draft,this.catalog);
      if(!s.powers.length&&!s.specials.some(p=>p.id!=='weapon')){ui.notifications?.warn?.('Escolha ao menos um poder além de Weapon.');return false;}
    }
    return true;
  }
  _hideDropdowns(except=null){
    this.element?.querySelectorAll('.iim-compact-dropdown').forEach(dropdown=>{
      if(dropdown===except)return;
      const list=dropdown.querySelector('.iim-threshold-list');
      if(list)list.hidden=true;
      dropdown.querySelector('[data-iim-open-threshold]')?.setAttribute('aria-expanded','false');
    });
  }
  async _onClick(event){
    const option=event.target.closest('[data-iim-suggestion]');
    if(option){event.preventDefault();this._chooseSuggestion(option);return;}
    const choice=event.target.closest('[data-iim-threshold-choice]');
    if(choice){
      event.preventDefault();
      const id=choice.dataset.iimThresholdChoice,value=choice.dataset.iimThresholdValue;
      const record=this.draft.restrictions.find(r=>r.id===id);
      if(record){
        const parts={...(this.restrictionParts.get(id)||parseRestrictionParts(id,record.value))};
        parts.threshold=value;this.restrictionParts.set(id,parts);
        record.value=formatRestrictionParts(id,parts);
      }
      const dropdown=choice.closest('.iim-compact-dropdown');
      dropdown?.querySelector('[data-iim-open-threshold]')?.replaceChildren(document.createTextNode(value));
      this._hideDropdowns();return;
    }
    const opener=event.target.closest('[data-iim-open-threshold]');
    if(opener){
      event.preventDefault();
      const dropdown=opener.closest('.iim-compact-dropdown');
      const list=dropdown?.querySelector('.iim-threshold-list');
      if(!list)return;
      const opening=list.hidden;this._hideDropdowns();this._hideSuggestions();
      list.hidden=!opening;opener.setAttribute('aria-expanded',String(opening));return;
    }
    if(!event.target.closest('.iim-compact-dropdown'))this._hideDropdowns();
    if(!event.target.closest('.iim-restriction-input-wrap'))this._hideSuggestions();
    const info=event.target.closest('[data-iim-info]');
    if(info){
      event.preventDefault(); event.stopPropagation();
      const kind=info.dataset.iimInfo;
      if(kind==='regular'){
        const power=this.catalog.powers.find(p=>p.uuid===info.dataset.powerUuid);
        if(power) await showPowerInfoDialog(power.name, `${power.powerSet}${power.prerequisites?` · Pré-requisito: ${power.prerequisites}`:''}`, power.description||power.cost||'');
      } else if(kind==='special'){
        const power=this.catalog.specials.find(p=>p.id===info.dataset.specialId);
        if(power) await showPowerInfoDialog(langName(power), 'Poder especial de Iconic Item', langDescription(power));
      }
      return;
    }
    const button=event.target.closest('[data-iim-action]');if(!button||this.busy)return;
    event.preventDefault();
    const action=button.dataset.iimAction;
    if(action==='previous'){this.step=Math.max(1,this.step-1);this.scroll=0;this.panelScroll={regular:0,special:0};await this.render(true);}
    if(action==='next'&&this._validStep()){this.step=Math.min(6,this.step+1);this.scroll=0;this.panelScroll={regular:0,special:0};await this.render(true);}
    if(action==='cancel')await this.close();
    if(action==='save')await this._save();
    if(action==='pick-image'){
      const Picker=foundry.applications?.apps?.FilePicker?.implementation||globalThis.FilePicker;
      if(!Picker){ui.notifications?.warn?.('O seletor de imagens não está disponível.');return;}
      new Picker({type:'image',current:this.draft.image||'',callback:path=>{this.draft.image=path;this._rerender();}}).render(true);
    }
  }
  async _sourceDocuments(uuids){
    const docs=new Map();
    for(const uuid of uuids){
      const document=await fromUuid(uuid);
      if(!document||document.type!=='power')throw new Error(`Não foi possível carregar o poder: ${uuid}`);
      docs.set(uuid,document);
    }
    return docs;
  }
  _makeFlags(managedPowerIds){
    const s=selectedEntries(this.draft,this.catalog),t=totals(this.draft,this.catalog);
    return {
      schema:3,isIconicItem:true,moduleVersion:VERSION,
      rulesSource:'Marvel Multiverse RPG — Avengers Expansion, Iconic Items',
      sourceDescription:this.draft.description,
      origin:s.origin?{name:s.origin.name,uuid:s.origin.uuid}:null,
      powers:{regular:s.powers.map(p=>({id:p.id,uuid:p.uuid,name:p.name,powerSet:p.powerSet,numbered:p.numbered,pickCost:powerPickCost(p),img:p.img})),
        special:s.specials.map(p=>({id:p.id,name:p.name,namePtBR:p.namePtBR||p.name,configSummary:specialConfigSummary(p,this.draft,this.catalog)}))},
      restrictions:s.restrictions.map(r=>({id:r.id,category:r.category,name:r.name,namePtBR:r.namePtBR||r.name,value:r.value||''})),
      narratorOverride:!!this.draft.narratorOverride,specialConfig:clone(this.draft.specialConfig),
      weaponDetails:clone(this.draft.weaponDetails),reliance:clone(this.draft.reliance),
      powerPicks:t.powerPicks,powerValue:t.powerValue,managedPowerIds
    };
  }
  async _ensureAdamantium(item){
    if(this.draft.itemType!=='weapon'||!specialIds(this.draft).includes('adamantium'))return;
    const changes=effect=>effect.system?.changes||effect.changes||[];
    if(Array.from(item.effects||[]).some(e=>changes(e).some(c=>c.key==='flags.multiverse-d616.adamantiumHealthDrIgnore')))return;
    await item.createEmbeddedDocuments('ActiveEffect',[{
      name:'Adamantium',img:'icons/svg/sword.svg',origin:item.uuid,disabled:false,transfer:false,type:'base',
      duration:{value:null,units:'seconds',expiry:null,expired:false},
      system:{changes:[{key:'flags.multiverse-d616.adamantiumHealthDrIgnore',type:'add',value:1,phase:'initial',priority:null}]}
    }]);
  }
  async _save(){
    if(this.busy)return;
    const result=validateDraft(this.draft,this.catalog);
    if(result.errors.length){ui.notifications?.error?.(result.errors[0]);return;}
    this.busy=true;
    try{
      const selected=this.draft.regularPowerUuids;
      const docs=await this._sourceDocuments(selected);
      const prev=this.editItem?.flags?.[MODULE_ID]||{};
      const existing=this.editItem?.flags?.[SYSTEM_ID]?.attachedPowers||[];
      const reconciliation=reconcileAttachedPowers(existing,prev.managedPowerIds||[],selected,docs,idFn);
      const specialPowerSnapshots=reconcileSpecialPowerSnapshots(reconciliation.list,
        selectedEntries(this.draft,this.catalog).specials,idFn);
      const flags=this._makeFlags(reconciliation.managedPowerIds),description=describe(this.draft,this.catalog);
      flags.managedSpecialPowerIds=specialPowerSnapshots.managedSpecialPowerIds;
      // Editing an existing worn item must not silently put it back on.
      if(prev.wornActive===false)flags.wornActive=false;
      let item;
      if(this.editItem){
        if(this.editItem.type!==this.draft.itemType)throw new Error('Não é possível mudar o tipo de um item existente.');
        const patch={name:this.draft.name.trim(),img:this.draft.image||this.editItem.img,
          'system.description':description,[`flags.${MODULE_ID}`]:flags,
          [`flags.${SYSTEM_ID}.attachedPowers`]:specialPowerSnapshots.list};
        if(this.draft.itemType==='weapon'){
          const system=weaponSystem(this.draft,description);
          for(const key of ['ability','attackTarget','attackKind','kind','range','attackRange','damageMultiplierBonus','damageType'])
            patch[`system.${key}`]=system[key];
        }
        await this.editItem.update(patch);
        item=this.editItem;
      } else {
        const isWeapon=this.draft.itemType==='weapon';
        item=await Item.create({name:this.draft.name.trim(),type:this.draft.itemType,
          img:this.draft.image||(isWeapon?'systems/multiverse-d616/icons/weapons.svg':'systems/multiverse-d616/icons/work.svg'),
          system:isWeapon?weaponSystem(this.draft,description):gearSystem(description),
          flags:{[MODULE_ID]:flags,[SYSTEM_ID]:{attachedPowers:specialPowerSnapshots.list}}}, {renderSheet:false});
        if(!item)throw new Error('Item.create não retornou um item.');
      }
      try{await this._ensureAdamantium(item);}catch(error){
        console.warn(`${MODULE_ID} | Adamantium não pôde ser configurado automaticamente`,error);
        ui.notifications?.warn?.('Item salvo, mas não foi possível criar o efeito Adamantium. Use a aba Efeitos da arma.');
      }
      ui.notifications?.info?.(this.editItem?`Item icônico “${item.name}” atualizado.`:`Item icônico “${item.name}” criado.`);
      await this.close();
      item.sheet?.render(true);
    } catch(error){console.error(`${MODULE_ID} | Falha ao salvar`,error);ui.notifications?.error?.(`Iconic Item Mancer: ${error.message}`);}
    finally{this.busy=false;}
  }
}

async function checkItemBandaging(item){
  const actor=item?.parent?.documentName==='Actor'?item.parent:null;
  if(!actor){ ui.notifications?.warn?.('Bandaging: coloque a jaqueta no inventário de um personagem.'); return false; }
  const report=diagnoseBandaging();
  const entry=report.find(e=>e.actorUuid===actor.uuid);
  if(!entry){ ui.notifications?.warn?.('Bandaging: o diagnóstico não encontrou esse Actor nem a condição. Veja o console (F12).'); return false; }
  if(!entry.canCure){ ui.notifications?.warn?.(`Bandaging: ${entry.reason}. Consulte o diagnóstico no console (F12).`); return false; }
  try {
    const cured=await cureWithBandaging(actor,{onCured:async(target,source)=>{
      if(typeof ChatMessage?.create==='function')await ChatMessage.create({
        speaker:ChatMessage.getSpeaker?.({actor:target})??{},
        content:`<p><strong>Bandaging — ${escapeHTML(source.name)}</strong>: Sangrando removido automaticamente de <strong>${escapeHTML(target.name)}</strong>.</p>`
      });
    }});
    if(cured)ui.notifications?.info?.('Bandaging removeu Sangrando.');
    else ui.notifications?.warn?.('Bandaging não removeu Sangrando. Veja as informações no console (F12).');
    return cured;
  }catch(e){console.error('[iconic-item-mancer] Verificação Bandaging',e);ui.notifications?.error?.(`Bandaging: ${e.message}`);return false;}
}

async function switchWeaponMode(item){
  const flags=item?.flags?.[MODULE_ID];if(!flags?.isIconicItem||item.type!=='weapon')return;
  const next=flags.weaponDetails?.activeMode==='agl'?'mle':'agl';
  await item.update({...weaponModePatch({weaponDetails:flags.weaponDetails},next),[`flags.${MODULE_ID}.weaponDetails.activeMode`]:next});
  ui.notifications?.info?.(`Modo ativo: ${next==='agl'?'Agility':'Melee'}.`);
}
function enhanceItemSheet(app,html){
  // ItemSheetV2 stores its document as `document`; legacy sheets use `item`.
  const item=app?.item||app?.document,flags=item?.flags?.[MODULE_ID];
  if(item?.documentName!=='Item' || !flags?.isIconicItem)return;
  const root=htmlElement(html);if(!root||root.querySelector('.iim-item-sheet-banner'))return;
  const parent=root.querySelector('form')||root.querySelector('.window-content')||root;
  const banner=document.createElement('section');banner.className='iim-item-sheet-banner';
  const selected=flags.weaponDetails?.activeMode||'mle';
  const wornRestriction=flags.restrictions?.some(r=>r.id==='unattached-worn');
  const canWear=item.parent?.documentName==='Actor'&&item.type==='item'&&wornRestriction&&item.isOwner;
  const isWorn=flags.wornActive!==false;
  const canCheckBandaging=!!item.parent && itemSpecialIds(item).includes('bandaging') && game.user?.isGM;
  banner.innerHTML=`<div class="iim-sheet-info"><strong><i class="fas fa-gem"></i> ICONIC ITEM</strong><span>Origem: ${escapeHTML(flags.origin?.name||'—')}</span><span>Power Value: <b>${Number(flags.powerValue)||1}</b></span></div><div class="iim-sheet-actions">${item.isOwner?`<button type="button" data-iim-edit><i class="fas fa-pen"></i> Editar no Mancer</button>`:''}${item.isOwner&&item.type==='weapon'?`<button type="button" data-iim-mode>${selected==='agl'?'Usar Melee':'Usar Agility'}</button>`:''}${canWear?`<button type="button" data-iim-worn title="Ativar/desativar os efeitos passivos da peça vestida"><i class="fas fa-shirt"></i> ${isWorn?'Vestido — Retirar':'Retirado — Vestir'}</button>`:''}${canCheckBandaging?`<button type="button" data-iim-bandaging-check title="Diagnosticar e executar a remoção passiva do Sangramento"><i class="fas fa-stethoscope"></i> Testar Bandaging</button>`:''}</div>`;
  parent.prepend(banner);
  // The native Item Sheet's `Usar` handler knows only regular Powers.
  // Route only exclusive Iconic Item snapshots through the module.
  root.addEventListener('click',event=>interceptSpecialSheetClick(event,item),true);
  banner.querySelector('[data-iim-edit]')?.addEventListener('click',()=>new IconicItemMancer({item}).render(true));
  banner.querySelector('[data-iim-mode]')?.addEventListener('click',async()=>{
    try{await switchWeaponMode(item);app.render(true);}catch(error){ui.notifications?.error?.(error.message);}
  });
  banner.querySelector('[data-iim-bandaging-check]')?.addEventListener('click',()=>checkItemBandaging(item));
  banner.querySelector('[data-iim-worn]')?.addEventListener('click',async()=>{
    try{
      await item.update({[`flags.${MODULE_ID}.wornActive`]:!isWorn});
      app.render(true);
    } catch(error){ui.notifications?.error?.(`Não foi possível alterar o estado Vestido: ${error.message}`);}
  });
}
function attachDirectoryButton(app,html){
  if(game.system?.id!==SYSTEM_ID)return;
  if(!(game.user?.isGM||game.user?.can?.('ITEM_CREATE')))return;
  const root=htmlElement(html);if(!root||root.querySelector('.iconic-item-mancer-button'))return;
  const actions=root.querySelector('.directory-header .header-actions')||root.querySelector('.directory-header .action-buttons')||root.querySelector('.header-actions')||root.querySelector('.action-buttons')||root.querySelector('.directory-header');
  if(!actions)return;
  const button=document.createElement('button');button.type='button';button.className='iconic-item-mancer-button mmc-btn';
  button.innerHTML=`<i class="fas fa-gem"></i> ${escapeHTML(text('ButtonLabel','Iconic Item Mancer'))}`;
  button.title=text('ButtonTitle','Criar arma ou equipamento icônico');
  button.addEventListener('click',()=>new IconicItemMancer().render(true));
  actions.append(button);
}
Hooks.once('init',()=>{
  Handlebars.registerHelper('iimEq',(a,b)=>a===b);
  game.iconicItemMancer={version:VERSION,open:()=>new IconicItemMancer().render(true),edit:item=>new IconicItemMancer({item}).render(true),switchWeaponMode,
    diagnoseBandaging:()=>automationRuntime?.inspect?.()??diagnoseBandaging(),rescanBandaging:()=>automationRuntime?.scan(),checkBandaging:checkItemBandaging};
  console.log(`${MODULE_ID} | v${VERSION} inicializado`);
});
Hooks.on('renderItemDirectory',attachDirectoryButton);
Hooks.on('renderItemSheet',(app,html)=>enhanceItemSheet(app,html));
Hooks.on('renderItemSheetV2',(app,html)=>enhanceItemSheet(app,html));
// ItemSheetV2 subclasses can emit only their class-specific hook in Foundry 14.
Hooks.on('renderApplicationV2',(app,html)=>{
  if(game.system?.id===SYSTEM_ID && (app?.item?.documentName==='Item'||app?.document?.documentName==='Item'))enhanceItemSheet(app,html);
});
const migrationPending=new Set();
let specialPowerCatalog=null;
async function ensureSpecialCatalog(){
  if(specialPowerCatalog)return specialPowerCatalog;
  const response=await fetch(`${base}/data/special-powers.json`);
  if(!response.ok)throw new Error(`Catálogo de poderes especiais indisponível (${response.status})`);
  specialPowerCatalog=await response.json();
  return specialPowerCatalog;
}
async function migrateSpecials(){
  if(!game.user?.isGM||game.system?.id!==SYSTEM_ID)return;
  const catalog=await ensureSpecialCatalog();
  const result=await migrateSpecialEquipmentItems({gameInstance:game,catalog});
  if(result.updated||result.failed)console.info(`[${MODULE_ID}] Migração dos poderes especiais:`,result);
}
async function migrateOneSpecialItem(item){
  if(!item?.uuid||migrationPending.has(item.uuid)||!item?.flags?.[MODULE_ID]?.isIconicItem)return;
  migrationPending.add(item.uuid);
  try{
    // The full migration includes embedded actor gear, world items and tokens;
    // restricting to the passed Item avoids unnecessary write calls here.
    const catalog=await ensureSpecialCatalog();
    const defs=new Set((item.flags[MODULE_ID].powers?.special||[]).map(p=>typeof p==='string'?p:p.id));
    const selected=catalog.filter(p=>defs.has(p.id)&&p.id!=='weapon');
    if(!selected.length)return;
    const current=item.flags?.[SYSTEM_ID]?.attachedPowers||[];
    const next=reconcileSpecialPowerSnapshots(current,selected,idFn);
    if(next.list.length===current.length)return;
    if(game.user?.isGM)await item.update({[`flags.${SYSTEM_ID}.attachedPowers`]:next.list,
      [`flags.${MODULE_ID}.managedSpecialPowerIds`]:next.managedSpecialPowerIds});
  }catch(error){console.warn(`[${MODULE_ID}] Falha ao migrar o item ${item.name}`,error);}
  finally{migrationPending.delete(item.uuid);}
}
Hooks.once('ready',()=>{
  if(game.system?.id!==SYSTEM_ID){ui.notifications?.warn?.('Iconic Item Mancer precisa do sistema Multiverse-D616.');return;}
  registerSpecialHudHandlers();
  void migrateSpecials().catch(error=>console.error(`[${MODULE_ID}] Migração inicial`,error));
});
Hooks.on('canvasReady',()=>{void migrateSpecials().catch(error=>console.error(`[${MODULE_ID}] Migração em canvas`,error));});
for(const action of ['createItem','updateItem']){
  Hooks.on(action,item=>{if(game?.user?.isGM)void migrateOneSpecialItem(item);});
}
const automationRuntime=registerSpecialPowerAutomation(Hooks, game);
export {IconicItemMancer,readCatalog,describe,enhanceItemSheet,attachDirectoryButton};
