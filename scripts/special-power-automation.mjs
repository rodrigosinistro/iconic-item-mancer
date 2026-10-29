/**
 * Iconic Item Mancer — runtime of passive Iconic Item powers.
 * Foundry VTT 14 / Multiverse-D616 0.2.99+.
 *
 * Bandaging may be represented on an Actor, an unlinked Token's synthetic
 * Actor (ActorDelta), or on the TokenDocument. Observe all three without
 * changing the system's existing condition-recovery rules.
 */
export const MODULE_ID = 'iconic-item-mancer';
export const BLEEDING = 'mmrpg.bleeding';

export function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === 'function') return [...collection.values()];
  if (typeof collection[Symbol.iterator] === 'function') return [...collection];
  return [];
}

export function itemSpecialIds(item) {
  const flags=item?.flags?.[MODULE_ID];
  if (!flags?.isIconicItem) return [];
  return Array.isArray(flags.powers?.special)
    ? flags.powers.special.map(s=>typeof s==='string'?s:s?.id).filter(Boolean) : [];
}

/** Owned gear is active; equipped weapons are active; Worn items can be removed. */
export function itemUsable(item,actor) {
  if (!item || !actor) return false;
  const parent=item.parent;
  // A synthetic Actor/ActorDelta may expose a different wrapper UUID for
  // the same embedded Item. Membership in actor.items is authoritative.
  const inInventory=collectionValues(actor.items).some(i=>i===item || (i?.id&&i.id===item.id));
  if (!inInventory && parent!==actor && (!parent?.uuid || parent.uuid!==actor.uuid)) return false;
  if (item.type!=='weapon' && item.type!=='item') return false;
  if (item.type==='weapon' && item.system?.equipped!==true) return false;
  const flags=item.flags?.[MODULE_ID];
  if (flags?.restrictions?.some(r=>r.id==='unattached-worn') && flags.wornActive===false) return false;
  return true;
}

export function findBandagingItem(actor) {
  return collectionValues(actor?.items).find(item=>
    itemSpecialIds(item).includes('bandaging') && itemUsable(item,actor))??null;
}

export function statusIds(effect) {
  const ids=new Set(collectionValues(effect?.statuses));
  // preCreate receives the pending document, whose statuses are not yet
  // reflected on actor.statuses. Some modules supply them only in _source.
  for (const id of collectionValues(effect?._source?.statuses)) ids.add(id);
  for (const id of collectionValues(effect?.data?.statuses)) ids.add(id);
  if (effect?.flags?.core?.statusId) ids.add(effect.flags.core.statusId);
  if (effect?._source?.flags?.core?.statusId) ids.add(effect._source.flags.core.statusId);
  if (typeof effect?.getFlag==='function') {
    const core=effect.getFlag('core','statusId');
    if (core) ids.add(core);
  }
  return ids;
}

function hasActorBleeding(actor) {
  if (!actor) return false;
  if (collectionValues(actor.statuses).includes(BLEEDING)) return true;
  if (collectionValues(actor.effects).some(effect=>!effect.disabled && statusIds(effect).has(BLEEDING))) return true;
  // Some Foundry Actor variants expose their active status via this method.
  try { if (actor.hasStatusEffect?.(BLEEDING)) return true; } catch {}
  return false;
}

function hasTokenBleeding(token) {
  if (!token) return false;
  const doc=token.document??token;
  if (collectionValues(doc?.effects).includes(BLEEDING)) return true;
  if (collectionValues(doc?.statuses).includes(BLEEDING)) return true;
  try {
    if (token.hasStatusEffect?.(BLEEDING) || doc.hasStatusEffect?.(BLEEDING)) return true;
  } catch {}
  return false;
}

/** Token identities must match by UUID, not actor ID: unlinked token actors may
 * share the same base ID but have different inventory and conditions. */
export function actorTokens(actor, canvasInstance=globalThis.canvas) {
  if (!actor) return [];
  return collectionValues(canvasInstance?.tokens?.placeables).filter(token => {
    const a=token.actor??token.document?.actor;
    return Boolean(a&&(a===actor||(a.uuid&&actor.uuid&&a.uuid===actor.uuid)));
  });
}

export function hasBleeding(actor, {token=null, canvasInstance=globalThis.canvas}={}) {
  if (hasActorBleeding(actor)) return true;
  if (token && hasTokenBleeding(token)) return true;
  return actorTokens(actor,canvasInstance).some(hasTokenBleeding);
}

/** Remove only bleeding; leave any other statuses in the same ActiveEffect. */
export async function clearBleeding(actor, {token=null,canvasInstance=globalThis.canvas}={}) {
  if (!hasBleeding(actor,{token,canvasInstance})) return false;
  const matches=collectionValues(actor?.effects).filter(e=>!e.disabled&&statusIds(e).has(BLEEDING));
  for (const effect of matches) {
    const statuses=collectionValues(effect.statuses);
    if (statuses.includes(BLEEDING)&&statuses.length>1) {
      await effect.update({statuses:statuses.filter(s=>s!==BLEEDING)});
    } else {
      await actor.deleteEmbeddedDocuments('ActiveEffect',[effect.id]);
    }
  }
  // In the D616 these methods also support synthetic Actors; the fallback
  // addresses a stale status if no corresponding ActiveEffect was found.
  if (hasActorBleeding(actor) && typeof actor?.toggleStatusEffect==='function') {
    await actor.toggleStatusEffect(BLEEDING,{active:false});
  }
  const tokens=token ? [token,...actorTokens(actor,canvasInstance).filter(t=>t!==token)] : actorTokens(actor,canvasInstance);
  for (const t of tokens) {
    if (!hasTokenBleeding(t)) continue;
    const doc=t.document??t;
    if (typeof doc.toggleStatusEffect==='function')
      await doc.toggleStatusEffect(BLEEDING,{active:false});
    else if (typeof t.toggleStatusEffect==='function')
      await t.toggleStatusEffect(BLEEDING,{active:false});
  }
  // Report success only if the condition is genuinely absent.
  return !hasBleeding(actor,{token,canvasInstance});
}

export function primaryGM(gameInstance) {
  if (!gameInstance?.user?.isGM) return false;
  const active=gameInstance?.users?.activeGM;
  if (active) return active.id===gameInstance.user.id;
  const first=collectionValues(gameInstance?.users).find(u=>u?.active&&u?.isGM);
  return !first||first.id===gameInstance.user.id;
}

const processing=new Set();
export async function cureWithBandaging(actor, {
  gameInstance=globalThis.game,token=null,canvasInstance=globalThis.canvas,onCured=null
}={}) {
  if (!primaryGM(gameInstance)||gameInstance?.system?.id!=='multiverse-d616') return false;
  if (!actor?.uuid||processing.has(actor.uuid)||!hasBleeding(actor,{token,canvasInstance})) return false;
  const item=findBandagingItem(actor);
  if (!item) return false;
  processing.add(actor.uuid);
  try {
    if (!findBandagingItem(actor)||!hasBleeding(actor,{token,canvasInstance})) return false;
    const cleared=await clearBleeding(actor,{token,canvasInstance});
    if (!cleared) {
      console.warn(`[${MODULE_ID}] Bandaging encontrou Sangrando em ${actor.name}, mas não conseguiu remover a condição`,{
        actorUuid:actor.uuid, tokenUuid:token?.document?.uuid, itemId:item.id
      });
      return false;
    }
    console.info(`[${MODULE_ID}] Bandaging: Sangrando removido de ${actor.name} por ${item.name}`);
    if (typeof onCured==='function') {
      try { await onCured(actor,item); }
      catch(error) { console.warn(`[${MODULE_ID}] Bandaging aplicado, mas falhou o aviso no chat`,error); }
    }
    return true;
  } finally { processing.delete(actor.uuid); }
}

/** Robustly walk Actor, ActorDelta, TokenDocument, and ActiveEffect parents. */
export function eventActor(doc) {
  if (!doc) return null;
  if (doc.documentName==='Actor') return doc;
  if (doc.actor?.documentName==='Actor') return doc.actor;
  if (doc.syntheticActor?.documentName==='Actor') return doc.syntheticActor;
  if (doc.parent && doc.parent!==doc) return eventActor(doc.parent);
  return null;
}

function relevantToken(doc) {
  if (doc?.documentName==='Token' || doc?.documentName==='TokenDocument') {
    return collectionValues(globalThis.canvas?.tokens?.placeables).find(t=>t.document===doc || t.id===doc.id) ?? {document:doc,actor:doc.actor};
  }
  if (doc?.documentName==='ActorDelta') return relevantToken(doc.parent);
  return null;
}

/** Human-readable non-mutating diagnostics, accessible in the GM console. */
export function diagnoseBandaging({gameInstance=globalThis.game,canvasInstance=globalThis.canvas}={}) {
  const targets=new Map();
  const add=(actor,token=null)=>{
    if (!actor?.uuid) return;
    const key=actor.uuid;
    const prev=targets.get(key);
    targets.set(key,{actor,token:token||prev?.token||null});
  };
  for (const a of collectionValues(gameInstance?.actors)) add(a);
  for (const t of collectionValues(canvasInstance?.tokens?.placeables)) add(t.actor??t.document?.actor,t);
  for (const c of collectionValues(gameInstance?.combats)) for (const cb of collectionValues(c.combatants)) add(cb.actor);
  const report=[];
  for (const {actor,token} of targets.values()) {
    const candidates=collectionValues(actor.items).filter(i=>itemSpecialIds(i).includes('bandaging'));
    if (!candidates.length && !hasBleeding(actor,{token,canvasInstance})) continue;
    const bleed=hasBleeding(actor,{token,canvasInstance});
    const gm=primaryGM(gameInstance), activeItem=findBandagingItem(actor);
    const reason=!gm?'Este cliente não é o GM principal':!bleed?'Sangramento não identificado no Actor/Token':!candidates.length?'Item Bandaging não encontrado no inventário':!activeItem?'O item não está ativo/vestido':'Pronto para remover';
    report.push({actor:actor.name,actorUuid:actor.uuid,token:token?.id||'',
      gmAuthorized:gm,actorBleeding:hasActorBleeding(actor),tokenBleeding:hasTokenBleeding(token),
      bleeding:bleed, conditionIds:[...new Set(collectionValues(actor.statuses).concat(collectionValues(actor.effects).flatMap(e=>[...statusIds(e)])))].join(', '),
      bandagingItems:candidates.map(i=>`${i.name} (${itemUsable(i,actor)?'ATIVO':'INATIVO'}, parent=${i.parent?.uuid||'—'})`).join(', ')||'—',
      canCure:Boolean(activeItem)&&bleed&&gm, reason});
  }
  console.table(report);
  return report;
}

function findAllActors(gameInstance,canvasInstance) {
  const targets=new Map();
  const add=(actor,token=null)=>{
    if (!actor?.uuid) return;
    const existing=targets.get(actor.uuid);
    targets.set(actor.uuid,{actor,token:token||existing?.token||null});
  };
  for (const a of collectionValues(gameInstance?.actors)) add(a);
  for (const t of collectionValues(canvasInstance?.tokens?.placeables)) add(t.actor??t.document?.actor,t);
  for (const c of collectionValues(gameInstance?.combats))
    for (const cb of collectionValues(c.combatants)) add(cb.actor);
  return [...targets.values()];
}

export function registerSpecialPowerAutomation(hooks=globalThis.Hooks,gameInstance=globalThis.game) {
  const safe=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const run=(actor,token=null)=>{
    if (!actor||!primaryGM(gameInstance)) return;
    void cureWithBandaging(actor,{
      gameInstance,token,
      onCured:async(target,item)=>{
        if (typeof globalThis.ChatMessage?.create!=='function') return;
        await globalThis.ChatMessage.create({
          speaker:globalThis.ChatMessage.getSpeaker?.({actor:target})??{},
          content:`<p><strong>Bandaging — ${safe(item.name)}</strong>: Sangrando removido automaticamente de <strong>${safe(target.name)}</strong> (poder passivo do Item Icônico).</p>`,
          flags:{[MODULE_ID]:{automation:{specialId:'bandaging',actorUuid:target.uuid,itemId:item.id}}}
        });
      }
    }).catch(e=>console.error(`[${MODULE_ID}] Falha na automação Bandaging`,e));
  };
  const fromDoc=doc=>run(eventActor(doc),relevantToken(doc));
  // Stop a fresh Bleeding ActiveEffect BEFORE it becomes active. This is
  // independent of asynchronous post-create hooks and combat turn ordering.
  // Only a bleeding-only effect is vetoed; never cancel other conditions.
  hooks.on('preCreateActiveEffect',(effect)=>{
    if(gameInstance?.system?.id!=='multiverse-d616') return;
    const statuses=[...statusIds(effect)];
    if(!statuses.includes(BLEEDING)||statuses.some(id=>id!==BLEEDING)) return;
    const actor=eventActor(effect);
    if(!actor || !findBandagingItem(actor)) return;
    // The effect is being created on the holder of an active Bandaging item.
    // Returning false from preCreate prevents the bleeding from applying.
    // Guard against a second/third client vetoing documents owned by the GM:
    // only the authority client enforces the preventive step.
    if(!primaryGM(gameInstance)) return;
    console.info(`[${MODULE_ID}] Bandaging: condição Sangrando bloqueada antes da aplicação em ${actor.name}`);
    if(typeof globalThis.ChatMessage?.create==='function'){
      void globalThis.ChatMessage.create({speaker:globalThis.ChatMessage.getSpeaker?.({actor})??{},
        content:`<p><strong>Bandaging — ${safe(findBandagingItem(actor)?.name)}</strong>: Sangramento impedido em <strong>${safe(actor.name)}</strong> (item icônico vestido).</p>`
      }).catch(e=>console.warn(`[${MODULE_ID}] Falha ao anunciar Bandaging`,e));
    }
    return false;
  });
  hooks.on('createActiveEffect',fromDoc);
  hooks.on('updateActiveEffect',fromDoc);
  hooks.on('createItem',fromDoc);
  hooks.on('updateItem',fromDoc);
  hooks.on('updateActor',actor=>run(actor));
  hooks.on('updateActorDelta',fromDoc);
  hooks.on('updateToken',fromDoc);
  hooks.on('createToken',fromDoc);
  // The D616 ongoing-conditions engine emits a chat card after dealing
  // condition damage. This is an additional notification path for scenarios
  // where the normal Actor/Token hooks do not carry the live status data yet.
  // We never heal Health already lost; this fallback prevents later ticks.
  hooks.on('createChatMessage',message=>{
    if(!primaryGM(gameInstance))return;
    const html=String(message?.content||'');
    if(!/dano de condição/i.test(html)||!/bleeding|sangrando/i.test(html))return;
    const token=globalThis.canvas?.tokens?.get?.(message.speaker?.token);
    const actor=token?.actor||gameInstance?.actors?.get?.(message.speaker?.actor);
    if(actor)run(actor,token||null);
  });
  const scan=()=>{
    if (!primaryGM(gameInstance)) return;
    for (const {actor,token} of findAllActors(gameInstance,globalThis.canvas)) run(actor,token);
  };
  // Only a diagnostic pass emits state; normal combat keeps quiet.
  const inspect=()=>{
    const report=diagnoseBandaging({gameInstance,canvasInstance:globalThis.canvas});
    for(const entry of report.filter(e=>e.bleeding&&!e.canCure))
      console.warn(`[${MODULE_ID}] Bandaging diagnóstico: ${entry.actor} — ${entry.reason}`,entry);
    return report;
  };
  hooks.once('ready',()=>{
    console.info(`[${MODULE_ID}] Automação Bandaging registrada (Actor, Token, ActorDelta e Combat)`);
    scan();
  });
  hooks.on('canvasReady',scan);
  // Start the cure before a turn transition is committed; there is no artificial
  // Health restoration if the system already inflicted damage before this hook.
  hooks.on('preUpdateCombat',(combat,changes)=>{
    if ('turn' in (changes??{}) || 'round' in (changes??{})) scan();
  });
  // The system's damage tick is on updateCombat. This is a safety re-check;
  // condition-creation hooks normally cure it long before the turn ends.
  hooks.on('updateCombat',(combat,changes)=>{
    if (!('turn' in (changes??{})||'round' in (changes??{}))) return;
    scan();
  });
  return {run,scan,inspect};
}
