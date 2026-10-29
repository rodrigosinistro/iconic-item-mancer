/** Iconic Item Powers as D616-native, independent power snapshots on equipment.
 * One representation for the equipment sheet and native D616 HUD.
 * This is NOT a claim that the D616 knows how to automate these new powers.
 */
export const MODULE_ID='iconic-item-mancer';
export const SYSTEM_ID='multiverse-d616';
export const SPECIAL_PREFIX='iconic-item-mancer:special:';
const copy=value=>JSON.parse(JSON.stringify(value));
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const values=c=>Array.isArray(c)?c:Array.isArray(c?.contents)?c.contents:typeof c?.values==='function'?[...c.values()]:[];
export const specialIdOfEntry=entry=>{
  const id=entry?.data?.flags?.[MODULE_ID]?.specialId;
  if(id)return String(id);
  const uuid=String(entry?.sourceUuid||'');
  return uuid.startsWith(SPECIAL_PREFIX)?uuid.slice(SPECIAL_PREFIX.length):null;
};
export function makeSpecialPowerSnapshot(def,id){
  if(!def?.id||def.id==='weapon')throw new Error('Poder especial inválido para associação.');
  const title=String(def.namePtBR||def.name||def.id);
  const effect=String(def.effectPtBR||def.descriptionPtBR||def.description||'');
  const summary=String(def.descriptionPtBR||def.description||effect);
  const data={type:'power',name:title,img:'icons/svg/aura.svg',effects:[],
    system:{powerSet:'Iconic Item',numbered:0,prerequisites:'Concedido pelo equipamento icônico',
      action:def.id==='bandaging'?'Passivo (ativação manual no HUD)':'Consultar efeito',
      trigger:'Enquanto o item estiver em uso',
      // D616 omits duration=Permanent from its HUD. These shortcuts are
      // informative controls, NOT a change to the actual duration of a passive.
      duration:'Especial — definido pelo item',range:'Pessoal',cost:'0',
      description:`<p>${html(summary)}</p>`,effect:`<p>${html(effect)}</p>`,
      ability:'',attackTarget:'',attackKind:'',attackEdgeMode:'',formula:'',
      attackRange:0,attackMultiplier:0,rollTargetNumber:0,powerCheck:false},
    flags:{[MODULE_ID]:{specialId:def.id,isSpecialPower:true}}};
  return {id,sourceUuid:`${SPECIAL_PREFIX}${def.id}`,name:title,img:data.img,data};
}
/** Never edit a manually customised snapshot. Remove ONLY previously managed
 * special entries when their special flag is deselected. Preserve regulars. */
export function reconcileSpecialPowerSnapshots(existing,selectedDefs,randomID){
  const selected=new Set(selectedDefs.filter(s=>s.id!=='weapon').map(s=>s.id));
  const list=values(existing).filter(e=>{
    const id=specialIdOfEntry(e);
    return !id||selected.has(id);
  }).map(copy);
  const managed=[];
  for(const def of selectedDefs){
    if(def.id==='weapon')continue; // weapon's attack already has a HUD entry
    const hit=list.find(e=>specialIdOfEntry(e)===def.id);
    if(hit){managed.push(hit.id);continue;}
    const entry=makeSpecialPowerSnapshot(def,randomID());
    list.push(entry);managed.push(entry.id);
  }
  return {list,managedSpecialPowerIds:managed};
}
export function specialDefinitionsForItem(item,catalog){
  if(!item?.flags?.[MODULE_ID]?.isIconicItem)return [];
  const chosen=item.flags[MODULE_ID].powers?.special||[];
  const ids=new Set(chosen.map(p=>typeof p==='string'?p:p?.id).filter(Boolean));
  return catalog.filter(d=>ids.has(d.id)&&d.id!=='weapon');
}
/** Migration for world/owned equipment created in Iconic Item Mancer <= 2.0.6.
 * It is idempotent, leaves manual snapshots and edited copies untouched,
 * and does not add actual Power Items to an actor (thus no extra power picks).
 */
export async function migrateSpecialEquipmentItems({gameInstance=globalThis.game,catalog=[],randomID=()=>foundry.utils.randomID(16)}={}){
  if(!gameInstance?.user?.isGM||gameInstance?.system?.id!==SYSTEM_ID)return {updated:0,failed:0};
  const unique=new Map();
  const add=i=>{if(i?.uuid&&i?.flags?.[MODULE_ID]?.isIconicItem&&(i.type==='item'||i.type==='weapon'))unique.set(i.uuid,i);};
  for(const i of values(gameInstance.items))add(i);
  for(const a of values(gameInstance.actors))for(const i of values(a.items))add(i);
  for(const t of values(globalThis.canvas?.tokens?.placeables))for(const i of values(t.actor?.items))add(i);
  let updated=0,failed=0;
  for(const item of unique.values()){
    const defs=specialDefinitionsForItem(item,catalog);
    if(!defs.length)continue;
    const current=item.flags?.[SYSTEM_ID]?.attachedPowers??[];
    const result=reconcileSpecialPowerSnapshots(current,defs,randomID);
    // Migration only adds entries; do not resync/remove saved associations here.
    if(result.list.length===current.length)continue;
    try{
      await item.update({[`flags.${SYSTEM_ID}.attachedPowers`]:result.list,
        [`flags.${MODULE_ID}.managedSpecialPowerIds`]:result.managedSpecialPowerIds});
      updated++;
    }catch(e){failed++;console.warn(`[${MODULE_ID}] Não foi possível migrar poderes especiais de ${item.name}`,e);}
  }
  return {updated,failed};
}
