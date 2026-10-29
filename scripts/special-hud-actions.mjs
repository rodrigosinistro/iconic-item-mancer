/** Interop with the D616 native attached-power HUD and equipment sheet.
 * Only Iconic Item exclusive powers are intercepted; normal D616 power use is
 * deliberately untouched. Passive Bandaging still has an independent runtime.
 */
import {itemUsable,cureWithBandaging,findBandagingItem} from './special-power-automation.mjs';
import {specialIdOfEntry} from './special-attached-powers.mjs';
const MOD='iconic-item-mancer',SYS='multiverse-d616';
const values=c=>Array.isArray(c)?c:Array.isArray(c?.contents)?c.contents:typeof c?.values==='function'?[...c.values()]:[];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stripped=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function powerEntry(item,id){
  const entries=item?.flags?.[SYS]?.attachedPowers??[];
  return entries.find(e=>e.id===id&&specialIdOfEntry(e))??null;
}
export function selectedHudActor({gameInstance=globalThis.game,canvasInstance=globalThis.canvas}={}){
  return canvasInstance?.tokens?.controlled?.[0]?.actor??
    (!gameInstance?.user?.isGM?gameInstance?.user?.character:null)??null;
}
async function presentSpecialPower(item,entry,gameInstance){
  const title=entry.data?.name||entry.name;
  const source=entry.data?.system||{};
  const effect=source.effect||source.description||'Consulte o Narrador para resolver este poder.';
  const message=`<h3>${safe(title)} — ${safe(item.name)}</h3><p><b>Iconic Item Power</b> · ${safe(source.action||'Especial')}</p><p>${safe(stripped(effect))}</p><p><small>O efeito está descrito no item. Somente Bandaging tem automação específica nesta versão; os demais poderes dependem da resolução prevista pelo Narrador.</small></p>`;
  if(typeof globalThis.ChatMessage?.create==='function'){
    await globalThis.ChatMessage.create({speaker:globalThis.ChatMessage.getSpeaker?.({actor:item.actor})??{},
      content:message});
  }else gameInstance?.ui?.notifications?.info?.(`${title}: ${stripped(effect)}`);
}
const pending=new Set();
export async function activateIconicSpecial(item,powerId,{gameInstance=globalThis.game,token=null}={}){
  const entry=powerEntry(item,powerId);
  if(!entry)return false;
  const actor=item.actor;
  if(!actor){globalThis.ui?.notifications?.warn?.('Adicione o Item Icônico ao inventário de um personagem.');return true;}
  if(!itemUsable(item,actor)){
    globalThis.ui?.notifications?.warn?.('É necessário equipar ou vestir o Item Icônico para usar este poder.');return true;
  }
  const key=`${actor.uuid}:${powerId}`;
  if(pending.has(key))return true;
  pending.add(key);
  try{
    const id=specialIdOfEntry(entry);
    if(id==='bandaging'){
      if(gameInstance?.user?.isGM){
        const cured=await cureWithBandaging(actor,{gameInstance,token});
        globalThis.ui?.notifications?.[cured?'info':'warn']?.(cured?'Bandaging: Sangramento removido.':'Bandaging: personagem não está Sangrando, ou o item não está ativo.');
      }else if(gameInstance?.socket?.emit){
        gameInstance.socket.emit(`module.${MOD}`,{action:'bandaging',actorUuid:actor.uuid,itemId:item.id});
        globalThis.ui?.notifications?.info?.('Solicitação de Bandaging enviada ao GM.');
      }else globalThis.ui?.notifications?.warn?.('O GM precisa executar a remoção de Sangramento.');
    }else await presentSpecialPower(item,entry,gameInstance);
  }catch(error){console.error(`[${MOD}] Falha na ativação de poder especial`,error);globalThis.ui?.notifications?.error?.(`Iconic Item Power: ${error.message}`);}
  finally{pending.delete(key);}
  return true;
}
/** Guard native D616 roll handler; special powers are informational unless
 * explicitly supported. Listener in capture phase runs before the system. */
export function interceptSpecialHudClick(event,{gameInstance=globalThis.game,canvasInstance=globalThis.canvas}={}){
  const button=event.target?.closest?.('.mmrpg-native-action-hud__action.attached-power[data-power-id]');
  if(!button)return false;
  const actor=selectedHudActor({gameInstance,canvasInstance});
  const item=actor?.items?.get?.(button.dataset.itemId);
  const entry=powerEntry(item,button.dataset.powerId);
  if(!entry)return false;
  event.preventDefault();event.stopImmediatePropagation();
  void activateIconicSpecial(item,entry.id,{gameInstance,token:canvasInstance?.tokens?.controlled?.[0]??null});
  return true;
}
export function interceptSpecialSheetClick(event,item,gameInstance=globalThis.game){
  const button=event.target?.closest?.('.mm-attached-power-use');
  if(!button)return false;
  const row=button.closest('.mm-attached-power[data-attached-power-id]');
  const entry=powerEntry(item,row?.dataset.attachedPowerId);
  if(!entry)return false;
  event.preventDefault();event.stopImmediatePropagation();
  void activateIconicSpecial(item,entry.id,{gameInstance});
  return true;
}
export function registerSpecialHudHandlers({gameInstance=globalThis.game,documentInstance=globalThis.document}={}){
  documentInstance?.addEventListener?.('click',event=>interceptSpecialHudClick(event,{gameInstance}),true);
  gameInstance?.socket?.on?.(`module.${MOD}`,async(data,senderId)=>{
    if(data?.action!=='bandaging'||!gameInstance?.user?.isGM)return;
    const actor=await globalThis.fromUuid?.(data.actorUuid).catch(()=>null);
    const item=actor?.items?.get?.(data.itemId);
    if(!item||!findBandagingItem(actor)||!itemUsable(item,actor)||!item.flags?.[MOD]?.isIconicItem)return;
    // If sender is available, require owner/GM permissions; never honor an
    // arbitrary request to mutate another player's character.
    const sender=senderId?gameInstance.users?.get?.(senderId):null;
    if(!sender||(!sender.isGM&&!actor.testUserPermission?.(sender,'OWNER')))return;
    await cureWithBandaging(actor,{gameInstance}).catch(e=>console.error(`[${MOD}] Solicitação Bandaging falhou`,e));
  });
}
