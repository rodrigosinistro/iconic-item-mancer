import {
  VERSION, MODULE_ID, SYSTEM_ID, defaultDraft, clone, escapeHTML as esc,
  powerPickCost, selectedEntries, totals, validateDraft, weaponSystem, gearSystem,
  draftFromItem, reconcileAttachedPowers
} from './rules.mjs';
import {reconcileSpecialPowerSnapshots} from './special-attached-powers.mjs';

export const WEB_VERSION = '1.0.1';
export const WEB_ID = 'iconic-item-mancer-web';
export const SYSTEM_VERSION = '0.2.99';
export function randomId(length=16) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values=new Uint8Array(length);
  if(globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for(let i=0;i<length;i++) values[i]=Math.floor(Math.random()*256);
  return Array.from(values,v=>alphabet[v%alphabet.length]).join('');
}
export const cleanText = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();
export const normalizeSearch = value => cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export const safeImage = value => {
  const str = String(value ?? '').trim();
  return /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,|(?:systems|modules|icons|worlds)\/)/i.test(str) ? str : '';
};
export function newDraft() {
  return {...defaultDraft(), visual: {glyph: 'shield', color: '#d83343'}};
}
export function normalizeDraft(value) {
  const base = newDraft();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('O arquivo não contém um item válido.');
  for (const key of ['name','description','image','originUuid']) if (typeof value[key] === 'string') base[key] = value[key];
  if (['weapon','item'].includes(value.itemType)) base.itemType = value.itemType;
  base.narratorOverride = value.narratorOverride === true;
  for (const key of ['regularPowerUuids','specialPowerIds']) base[key] = [...new Set((Array.isArray(value[key]) ? value[key] : []).filter(v => typeof v === 'string'))];
  base.restrictions = (Array.isArray(value.restrictions) ? value.restrictions : []).filter(v => v && typeof v.id === 'string').map(v => ({id:v.id,value:String(v.value ?? '')}));
  for (const key of ['specialConfig','reliance','weaponDetails','visual']) {
    for (const prop of Object.keys(base[key])) if (value[key] && ['string','number'].includes(typeof value[key][prop])) base[key][prop] = value[key][prop];
  }
  if (!['none','tech','magic'].includes(base.reliance.type)) base.reliance.type = 'none';
  for (const mode of ['primaryMode','activeMode']) if (!['mle','agl'].includes(base.weaponDetails[mode])) base.weaponDetails[mode] = 'mle';
  if (!['health','focus'].includes(base.weaponDetails.damageType)) base.weaponDetails.damageType = 'health';
  if (!/^#[0-9a-f]{6}$/i.test(base.visual.color)) base.visual.color = '#d83343';
  if (!['shield','sword','hammer','gem','gauntlet','bolt'].includes(base.visual.glyph)) base.visual.glyph = 'shield';
  base.image = safeImage(base.image);
  return base;
}
export function makeCatalog(powers, origins, restrictions, specials) {
  return {
    powers:powers.filter(p=>p.type==='power').map(p=>({
      id:p._id, uuid:`Compendium.${SYSTEM_ID}.powers.Item.${p._id}`, name:p.name,
      img:p.img || '',powerSet:p.system?.powerSet || 'Basic',numbered:Number(p.system?.numbered)||0,
      prerequisites:p.system?.prerequisites||'',description:p.system?.description||'',
      cost:p.system?.cost||'',source:{type:'power',name:p.name,img:p.img,system:clone(p.system||{}),effects:clone(p.effects||[]),flags:clone(p.flags||{})}
    })).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true})),
    origins:origins.filter(p=>p.type==='origin').map(p=>({id:p._id,uuid:`Compendium.${SYSTEM_ID}.origins.Item.${p._id}`,name:p.name,description:p.system?.description||'',examples:p.system?.examples||''})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),
    restrictions, specials
  };
}
export function extendedCatalog(base, document) {
  const result={...base,powers:[...base.powers],origins:[...base.origins]};
  const f=document?.flags?.[MODULE_ID];
  if(!f) return result;
  if(f.origin?.uuid && !result.origins.some(o=>o.uuid===f.origin.uuid)) result.origins.push({...f.origin,description:'Origem preservada do item importado.'});
  for(const power of f.powers?.regular||[]) {
    if(result.powers.some(p=>p.uuid===power.uuid)) continue;
    const snapshot=(document.flags?.[SYSTEM_ID]?.attachedPowers||[]).find(p=>p.sourceUuid===power.uuid);
    if(!snapshot?.data) throw new Error(`O poder ${power.name || power.uuid} não possui uma cópia no arquivo importado.`);
    result.powers.push({...power,description:snapshot.data.system?.description||'',source:clone(snapshot.data)});
  }
  return result;
}
export function importItem(input, baseCatalog) {
  const doc=input?.document ?? input;
  if (!doc || !['weapon','item'].includes(doc.type) || !doc.flags?.[MODULE_ID]?.isIconicItem)
    throw new Error('Selecione um JSON de Iconic Item exportado pelo site ou pelo módulo do Foundry.');
  const catalog=extendedCatalog(baseCatalog,doc);
  const draft=normalizeDraft({...draftFromItem(doc),visual:doc.flags?.[WEB_ID]?.visual});
  const missingRegular=draft.regularPowerUuids.filter(id=>!catalog.powers.some(p=>p.uuid===id));
  const missingSpecial=draft.specialPowerIds.filter(id=>!catalog.specials.some(p=>p.id===id));
  if(missingRegular.length || missingSpecial.length) throw new Error('O item contém poderes que não puderam ser identificados.');
  return {draft,document:clone(doc),catalog};
}
export function configSummary(power,draft,catalog) {
  const c=draft.specialConfig;
  if(['reduced-focus','stackable'].includes(power.id)) return catalog.powers.find(p=>p.uuid===c[power.id==='stackable'?'stackableTarget':'reducedFocusTarget'])?.name || 'Selecione o poder afetado';
  if(power.id==='damage-switch')return `Dano alternativo: ${c.damageSwitch==='focus'?'Focus':'Health'}`;
  if(power.id==='effect-options')return c.effectOptions;
  if(power.id==='negatite')return c.negatiteMode==='damage'?'+1 no multiplicador Health':'Ignora 10 de proteção';
  return '';
}
export function itemDescription(draft,catalog) {
  const s=selectedEntries(draft,catalog),t=totals(draft,catalog);
  return `<section><h2>Iconic Item</h2><p>${esc(draft.description).replaceAll('\n','<br>')}</p><p><b>Origem:</b> ${esc(s.origin?.name||'—')}</p><h3>Poderes</h3><ul>${s.powers.map(p=>`<li><b>${esc(p.name)}</b> — ${powerPickCost(p)} pick(s)</li>`).join('')}${s.specials.map(p=>`<li><b>${esc(p.namePtBR||p.name)}</b>${configSummary(p,draft,catalog)?` — ${esc(configSummary(p,draft,catalog))}`:''}<p>${esc(p.effectPtBR||p.descriptionPtBR||p.description)}</p></li>`).join('')}</ul>${draft.itemType==='weapon'?`<h3>Arma</h3><p>Melee: ${esc(draft.weaponDetails.meleeRange)} / DM ${Number(draft.weaponDetails.meleeDamageMultiplierBonus)||0}<br>Agility: ${esc(draft.weaponDetails.agilityRange)} / DM ${Number(draft.weaponDetails.agilityDamageMultiplierBonus)||0}</p>`:''}<h3>Restrições</h3><ul>${s.restrictions.map(r=>`<li><b>${esc(r.namePtBR||r.name)}</b>${r.value?`: ${esc(r.value)}`:''}</li>`).join('')||'<li>Nenhuma.</li>'}</ul>${draft.reliance.type!=='none'?`<p><b>${draft.reliance.type==='tech'?'Tech Reliance':'Magic Item Reliance'}:</b> ${esc(draft.reliance.affected||'Conforme o Narrador')}</p>`:''}<hr><p><b>Power Picks:</b> ${t.powerPicks} · <b>Restrições:</b> ${t.restrictionCount} · <b>Power Value:</b> ${t.powerValue}</p></section>`;
}
export function createFoundryItem(draft,catalog,{randomID,existingDocument=null,validate=true}={}) {
  randomID ||= randomId;
  const validation=validateDraft(draft,catalog);
  if(validate && validation.errors.length) throw new Error(validation.errors[0]);
  const s=selectedEntries(draft,catalog),t=totals(draft,catalog),previous=existingDocument?.flags?.[MODULE_ID]||{};
  const documents=new Map(s.powers.map(p=>[p.uuid,{...p.source,uuid:p.uuid}]));
  const regular=reconcileAttachedPowers(existingDocument?.flags?.[SYSTEM_ID]?.attachedPowers||[],previous.managedPowerIds||[],draft.regularPowerUuids,documents,randomID);
  const special=reconcileSpecialPowerSnapshots(regular.list,s.specials,randomID);
  const flags={...clone(existingDocument?.flags||{}),
    [MODULE_ID]:{...clone(previous),schema:3,isIconicItem:true,moduleVersion:VERSION,
      rulesSource:'Marvel Multiverse RPG — Avengers Expansion, Iconic Items',sourceDescription:draft.description,
      origin:s.origin?{name:s.origin.name,uuid:s.origin.uuid}:null,
      powers:{regular:s.powers.map(({id,uuid,name,powerSet,numbered,img})=>({id,uuid,name,powerSet,numbered,img,pickCost:powerPickCost({numbered})})),
        special:s.specials.map(p=>({id:p.id,name:p.name,namePtBR:p.namePtBR||p.name,configSummary:configSummary(p,draft,catalog)}))},
      restrictions:s.restrictions.map(r=>({id:r.id,category:r.category,name:r.name,namePtBR:r.namePtBR||r.name,value:r.value||''})),
      narratorOverride:!!draft.narratorOverride,specialConfig:clone(draft.specialConfig),weaponDetails:clone(draft.weaponDetails),reliance:clone(draft.reliance),
      powerPicks:t.powerPicks,powerValue:t.powerValue,managedPowerIds:regular.managedPowerIds,managedSpecialPowerIds:special.managedSpecialPowerIds},
    [SYSTEM_ID]:{...clone(existingDocument?.flags?.[SYSTEM_ID]||{}),attachedPowers:special.list},
    [WEB_ID]:{version:WEB_VERSION,visual:clone(draft.visual)},
    exportSource:{system:SYSTEM_ID,systemVersion:SYSTEM_VERSION}
  };
  const effects=clone(existingDocument?.effects||[]);
  if(draft.itemType==='weapon' && draft.specialPowerIds.includes('adamantium') && !effects.some(e=>(e.system?.changes||e.changes||[]).some(c=>c.key==='flags.multiverse-d616.adamantiumHealthDrIgnore'))) {
    effects.push({name:'Adamantium',img:'icons/svg/sword.svg',disabled:false,transfer:false,type:'base',
      duration:{value:null,units:'seconds',expiry:null,expired:false},
      system:{changes:[{key:'flags.multiverse-d616.adamantiumHealthDrIgnore',type:'add',value:1,phase:'initial',priority:null}]}});
  }
  const description=itemDescription(draft,catalog);
  return {name:draft.name.trim(),type:draft.itemType,img:safeImage(draft.image)||(draft.itemType==='weapon'?'systems/multiverse-d616/icons/weapons.svg':'systems/multiverse-d616/icons/work.svg'),
    system:{...clone(existingDocument?.system||{}),...(draft.itemType==='weapon'?weaponSystem(draft,description):gearSystem(description))},effects,flags};
}
export function fileSlug(name) {return normalizeSearch(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'iconic-item';}
