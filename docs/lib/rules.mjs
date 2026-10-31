/** Iconic Item rules and document adapters. No Foundry globals required. */
export const VERSION = '2.0.8';
export const MODULE_ID = 'iconic-item-mancer';
export const SYSTEM_ID = 'multiverse-d616';
export const RESTRICTION_CATEGORIES = [
  {id:'access',label:'Acesso',original:'Access'},
  {id:'challenging',label:'Desafiadora',original:'Challenging'},
  {id:'obvious',label:'Óbvia',original:'Obvious'},
  {id:'unattached',label:'Desanexada',original:'Unattached'},
  {id:'use',label:'Uso',original:'Use'}
];

/** Values stay as the legacy text format in item flags for backward compatibility. */
export const RESTRICTION_PARTS = Object.freeze({
  'access-min-ability': {label:'Habilidade',values:['Melee','Agility','Resilience','Vigilance','Ego','Logic'],min:2,max:9},
  'access-min-defense': {label:'Defesa',values:['Melee Defense','Agility Defense','Resilience Defense','Vigilance Defense','Ego Defense','Logic Defense'],min:2,max:30},
  'access-min-check': {label:'Habilidade',values:['Melee','Agility','Resilience','Vigilance','Ego','Logic'],min:2,max:20}
});
export function parseRestrictionParts(id, text='') {
  const raw=String(text??'').trim();
  if (!RESTRICTION_PARTS[id] || !raw) return {attribute:'',threshold:''};
  const pattern=id==='access-min-check' ? /^(.+?)\s+non-combat\s*\+?\s*(\d+)$/i : /^(.+?)\s+\+?(\d+)$/;
  const match=raw.match(pattern);
  return match?{attribute:match[1].trim(),threshold:match[2]}:{attribute:'',threshold:''};
}
export function formatRestrictionParts(id, parts) {
  const {attribute='',threshold=''}=parts||{};
  if(!RESTRICTION_PARTS[id] || !attribute || !threshold) return '';
  const suffix=id==='access-min-check'?' non-combat +':' ';
  return `${attribute}${suffix}${threshold}`;
}
export function defaultDraft() {
  return {
    name:'', description:'', image:'', itemType:'weapon', originUuid:'',
    restrictions:[], narratorOverride:false, regularPowerUuids:[], specialPowerIds:[],
    specialConfig:{damageSwitch:'focus',effectOptions:'',negatiteMode:'penetration',reducedFocusTarget:'',stackableTarget:''},
    reliance:{type:'none',affected:''},
    weaponDetails:{primaryMode:'mle',activeMode:'mle',meleeRange:'Reach',agilityRange:'5',meleeDamageMultiplierBonus:0,agilityDamageMultiplierBonus:0,damageType:'health'}
  };
}
export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function powerPickCost(power) {
  const n = Number(power?.numbered ?? power?.system?.numbered ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
export function powerFamilyKey(power) {
  const name = String(power?.name ?? '').trim().replace(/\s+\d+$/,'').toLocaleLowerCase();
  return `${String(power?.powerSet ?? power?.system?.powerSet ?? '').toLocaleLowerCase()}::${name}`;
}
export function numericRange(value) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Math.max(0,Math.floor(Number(match[0]))) : 0;
}
export function specialIds(draft) {
  return [...new Set([...(draft.specialPowerIds||[]).filter(id=>id!=='weapon'),...(draft.itemType==='weapon'?['weapon']:[])])];
}
export function selectedEntries(draft,catalog) {
  const regular = new Set(draft.regularPowerUuids||[]), special = new Set(specialIds(draft));
  return {
    powers: (catalog.powers||[]).filter(p=>regular.has(p.uuid)),
    specials:(catalog.specials||[]).filter(p=>special.has(p.id)),
    restrictions:(draft.restrictions||[]).map(r=>{
      const def=(catalog.restrictions||[]).find(x=>x.id===r.id);
      return def?{...def,value:r.value??''}:null;
    }).filter(Boolean),
    origin:(catalog.origins||[]).find(o=>o.uuid===draft.originUuid)||null
  };
}
export function totals(draft,catalog) {
  const selection=selectedEntries(draft,catalog);
  const powerPicks=selection.powers.reduce((n,p)=>n+powerPickCost(p),0)+selection.specials.length;
  return {powerPicks,restrictionCount:selection.restrictions.length,powerValue:Math.max(1,powerPicks-selection.restrictions.length)};
}
export function validateDraft(draft,catalog) {
  const errors=[],warnings=[];
  const selection=selectedEntries(draft,catalog);
  if (!String(draft.name??'').trim()) errors.push('Informe o nome do item.');
  if (!['weapon','item'].includes(draft.itemType)) errors.push('Escolha Arma ou Equipamento.');
  if (!selection.origin) errors.push('Escolha a origem do item.');
  if (!selection.powers.length && !selection.specials.some(p=>p.id!=='weapon'))
    errors.push('Selecione pelo menos um poder além da propriedade Weapon.');
  if (selection.restrictions.length!==(draft.restrictions||[]).length)
    errors.push('Há restrições que não pertencem ao catálogo.');
  if (selection.restrictions.length>3 && !draft.narratorOverride)
    errors.push('São permitidas até 3 restrições sem exceção do Narrador.');
  if (selection.restrictions.length>3 && draft.narratorOverride)
    warnings.push('A exceção do Narrador permite mais de 3 restrições.');
  for (const category of RESTRICTION_CATEGORIES.filter(c=>c.id!=='obvious')) {
    if (selection.restrictions.filter(r=>r.category===category.id).length>1)
      errors.push(`A categoria ${category.original} aceita apenas uma restrição.`);
  }
  for (const restriction of selection.restrictions) {
    if (restriction.hasValue && !String(restriction.value??'').trim())
      errors.push(`Informe o parâmetro de ${restriction.namePtBR||restriction.name}.`);
    if (restriction.hasValue && restriction.valueType==='number' && String(restriction.value??'').trim()) {
      const value=Number(restriction.value);
      if (!Number.isFinite(value) || !Number.isInteger(value) || (restriction.min!==undefined && value<restriction.min)
        || (restriction.max!==undefined && value>restriction.max))
        errors.push(`Valor inválido para ${restriction.namePtBR||restriction.name}.`);
    }
    const split=RESTRICTION_PARTS[restriction.id];
    if(split && String(restriction.value??'').trim()) {
      const parts=parseRestrictionParts(restriction.id,restriction.value);
      const value=Number(parts.threshold);
      if(!split.values.includes(parts.attribute) || !parts.threshold || !Number.isInteger(value) || value<split.min || value>split.max)
        errors.push(`Valor inválido para ${restriction.namePtBR||restriction.name}. Escolha uma opção de ${split.min} a ${split.max}.`);
    }
  }
  if (selection.restrictions.some(r=>r.category==='unattached') && selection.specials.some(p=>p.id==='constructable'))
    errors.push('Constructable é incompatível com restrições Unattached.');
  if (selection.specials.some(p=>p.id==='stackable') && !selection.powers.some(p=>p.uuid===draft.specialConfig?.stackableTarget&&Number(p.numbered)>0))
    errors.push('Stackable precisa indicar um poder numerado selecionado.');
  if (selection.specials.some(p=>p.id==='reduced-focus') && !selection.powers.some(p=>p.uuid===draft.specialConfig?.reducedFocusTarget))
    errors.push('Reduced Focus precisa indicar um poder regular selecionado.');
  if (selection.specials.some(p=>p.id==='effect-options') && !String(draft.specialConfig?.effectOptions||'').trim())
    warnings.push('Descreva os efeitos permitidos por Effect Options.');
  if (selection.specials.some(p=>p.id==='adamantium')) {
    if (draft.itemType!=='weapon') warnings.push('Adamantium só automatiza a redução de RD em armas equipadas; no equipamento, sua aplicação é manual.');
    if (!selection.restrictions.some(r=>r.category==='unattached') && !selection.restrictions.some(r=>r.id==='access-power' && /healing\s*factor/i.test(String(r.value))))
      warnings.push('Adamantium: sem Unattached, verifique a exigência de Healing Factor do portador.');
  }
  if (selection.specials.some(p=>p.id==='uru') && !/asgard/i.test(selection.origin?.name||''))
    warnings.push('Uru normalmente está associado à origem Mythic: Asgardian.');
  if (draft.itemType==='weapon') {
    for (const prop of ['meleeDamageMultiplierBonus','agilityDamageMultiplierBonus'])
      if (!Number.isFinite(Number(draft.weaponDetails?.[prop]))) errors.push('O bônus de dano da arma deve ser um número.');
  }
  return {errors:[...new Set(errors)], warnings:[...new Set(warnings)]};
}
export function weaponSystem(draft,description) {
  const w=draft.weaponDetails||{}, mode=w.activeMode==='agl'?'agl':'mle', agility=mode==='agl';
  const range=String(agility?w.agilityRange||'5':w.meleeRange||'Reach');
  return {
    description, quantity:1, size:'', ability:mode,attack:true,formula:'{1d6,1dm,1d6}',
    kind:agility?'ranged':'close',range, damageMultiplierBonus:String(Number(agility?w.agilityDamageMultiplierBonus:w.meleeDamageMultiplierBonus)||0),
    rule:'Arma icônica — propriedades e restrições registradas no Iconic Item Mancer.',
    category:'Iconic Item',reach:String(w.meleeRange||'Reach'),
    equipped:false,attackTarget:mode, attackKind:agility?'ranged':'close', attackRange:numericRange(range),
    damageType:w.damageType==='focus'?'focus':'health',attackEdgeMode:'',attackMultiplier:0
  };
}
export function gearSystem(description) {
  return {description,quantity:1,size:'',ability:'',attack:false,formula:'{1d6,1dm,1d6}',weight:0};
}
export function weaponModePatch(draft,mode) {
  const w=draft.weaponDetails||{},agility=mode==='agl';
  const range=String(agility?w.agilityRange||'5':w.meleeRange||'Reach');
  return {
    'system.ability':agility?'agl':'mle','system.attackTarget':agility?'agl':'mle',
    'system.attackKind':agility?'ranged':'close','system.kind':agility?'ranged':'close',
    'system.range':range,'system.attackRange':numericRange(range),
    'system.damageMultiplierBonus':String(Number(agility?w.agilityDamageMultiplierBonus:w.meleeDamageMultiplierBonus)||0)
  };
}
/** The D616 equipment engine expects a list of INDEPENDENT Power item snapshots. */
export function powerSnapshot(document,randomID) {
  const source=typeof document.toObject==='function'?document.toObject():document;
  if (source?.type!=='power') throw new Error('A origem não é um item do tipo Power.');
  const data={type:'power',name:String(source.name||'Poder'),img:String(source.img||'icons/svg/mystery-man.svg'),
    system:clone(source.system||{}),effects:clone(source.effects||[]),flags:clone(source.flags||{})};
  return {id:randomID(),sourceUuid:String(document.uuid||source.uuid||''),name:data.name,img:data.img,data};
}
/** Leave manually attached/edited Powers untouched; only remove previously managed entries that were unselected. */
export function reconcileAttachedPowers(existing,previousManagedIds,selectedUuids,documents,randomID) {
  const wanted=new Set(selectedUuids),managed=new Set(previousManagedIds||[]),list=[];
  for (const entry of existing||[]) {
    if (!entry?.id||entry?.data?.type!=='power') continue;
    if (managed.has(entry.id) && !wanted.has(entry.sourceUuid)) continue;
    list.push(clone(entry));
  }
  const generated=[];
  for (const uuid of wanted) {
    const hit=list.find(p=>p.sourceUuid===uuid);
    if (hit) { generated.push(hit.id); continue; }
    const doc=documents.get(uuid);
    if (!doc) throw new Error(`Poder não encontrado para associar: ${uuid}`);
    const snapshot=powerSnapshot(doc,randomID);
    list.push(snapshot); generated.push(snapshot.id);
  }
  return {list,managedPowerIds:generated};
}
/** Reopening an old 1.x item does not discard any existing data. */
export function draftFromItem(item) {
  const flags=item.flags?.[MODULE_ID]||{};
  const draft=defaultDraft();
  draft.name=item.name||'';
  draft.description=flags.sourceDescription??'';
  if (!draft.description && typeof item.system?.description==='string') {
    // Recover the author's narrative from 1.1.x descriptions without
    // accidentally importing the generated Powers/Restrictions HTML.
    const legacy=item.system.description.match(/<h2>Iconic Item<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
    if (legacy) draft.description=legacy[1]
      .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'')
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
      .replace(/&#0?39;/g,"'").replace(/&amp;/g,'&');
  }
  draft.image=item.img||'';
  draft.itemType=item.type==='weapon'?'weapon':'item';
  draft.originUuid=flags.origin?.uuid||'';
  draft.restrictions=clone(flags.restrictions||[]).map(r=>({id:r.id,value:r.value||''}));
  draft.narratorOverride=!!flags.narratorOverride;
  draft.regularPowerUuids=(flags.powers?.regular||[]).map(p=>p.uuid).filter(Boolean);
  draft.specialPowerIds=(flags.powers?.special||[]).map(p=>p.id).filter(id=>id&&id!=='weapon');
  draft.specialConfig={...draft.specialConfig,...clone(flags.specialConfig||{})};
  draft.reliance={...draft.reliance,...clone(flags.reliance||{})};
  draft.weaponDetails={...draft.weaponDetails,...clone(flags.weaponDetails||{})};
  if (item.type==='weapon' && !flags.weaponDetails) {
    const mode=item.system?.ability==='agl'?'agl':'mle';
    draft.weaponDetails.primaryMode=mode;draft.weaponDetails.activeMode=mode;
    draft.weaponDetails.damageType=item.system?.damageType||'health';
    if(mode==='agl') {draft.weaponDetails.agilityRange=item.system?.range||'5';draft.weaponDetails.agilityDamageMultiplierBonus=Number(item.system?.damageMultiplierBonus)||0;}
    else {draft.weaponDetails.meleeRange=item.system?.range||'Reach';draft.weaponDetails.meleeDamageMultiplierBonus=Number(item.system?.damageMultiplierBonus)||0;}
  }
  return draft;
}
