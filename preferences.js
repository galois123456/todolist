export const preferenceDefaults={theme:'system',search:'',statusFilter:'all',categoryFilter:'all',sort:'due',sourceFilter:'tasks'};
export function normalizePreferences(raw={}){
 const value={...preferenceDefaults};
 for(const [key,allowed] of Object.entries({theme:['light','dark','system'],statusFilter:['all','active','done','today','week','month','threeDays','fiveDays','sevenDays','overdue'],sort:['due','priority','start','new','title','category']}))if(allowed.includes(raw[key]))value[key]=raw[key];
 for(const key of ['search','categoryFilter','sourceFilter'])if(typeof raw[key]==='string')value[key]=raw[key].slice(0,key==='search'?500:100);
 return value;
}
export function createPreferences({db,storage=localStorage,onApply,onStatus=()=>{}}){
 let owner=null,generation=0,pending={},running=null,timer=null,ready=false,revision=0,readSequence=0;
 const cache=id=>`school-todo-preferences-${id}`;
 const queued=id=>`${cache(id)}-pending`;
 const read=key=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
 const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
 const checked=result=>{if(result.error)throw result.error;return result.data;};
 function reset(){generation++;readSequence++;clearTimeout(timer);owner=null;pending={};running=null;ready=false;}
 async function flush(){
  clearTimeout(timer);if(!owner||!Object.keys(pending).length)return;
  if(running){await running;return flush();}
  const id=owner,token=generation,batch={...pending};
  const job=(async()=>{
   try{
    const saved=checked(await db.rpc('save_todo_preferences',{p_patch:batch}));
    if(token!==generation)return;
    for(const key of Object.keys(batch))if(pending[key]===batch[key])delete pending[key];
    write(queued(id),pending);write(cache(id),normalizePreferences({...saved,...pending}));onStatus(Object.keys(pending).length?'설정 저장 중…':'');
   }catch(error){if(token===generation)onStatus('설정 동기화 실패: '+error.message+' · 연결을 확인하세요. 최초 업데이트는 migrate-ver1.30.sql 실행이 필요합니다.');throw error;}
  })();running=job;
  try{await job;}finally{if(token===generation)running=null;}
  if(token===generation&&Object.keys(pending).length)await flush();
 }
 function patch(changes){
  if(!owner)return;
  revision++;const normalized=normalizePreferences(changes);
  for(const key of Object.keys(changes))if(key in preferenceDefaults)pending[key]=normalized[key];
  write(queued(owner),pending);write(cache(owner),{...(read(cache(owner))||preferenceDefaults),...pending});
  onStatus('설정 저장 중…');clearTimeout(timer);timer=setTimeout(()=>{flush().catch(()=>{});},350);
 }
 async function sync(){
  if(!owner||!ready)return;
  const id=owner,token=generation;
  try{
   await flush();
   const version=revision,readToken=++readSequence;
   const row=checked(await db.from('todo_preferences').select('settings').eq('user_id',id).maybeSingle());
   if(token!==generation||version!==revision||readToken!==readSequence||Object.keys(pending).length)return;
   if(row){const value=normalizePreferences(row.settings);write(cache(id),value);await onApply(value);onStatus('');}
  }catch(error){if(token===generation)onStatus('설정 동기화 실패: '+error.message);}
 }
 async function open(id){
  reset();owner=id;const token=generation;pending=read(queued(id))||{};
  const local=read(cache(id));await onApply(normalizePreferences({...local,...pending}));
  if(token!==generation)return;
  ready=true;
  try{
   await flush();
   const version=revision,readToken=++readSequence;
   const row=checked(await db.from('todo_preferences').select('settings').eq('user_id',id).maybeSingle());
   if(token!==generation||version!==revision||readToken!==readSequence||Object.keys(pending).length)return;
   const value=normalizePreferences(row?.settings||local||preferenceDefaults);write(cache(id),value);await onApply(value);onStatus('');
  }catch(error){if(token===generation)onStatus('설정 동기화 실패: '+error.message+' · migrate-ver1.30.sql 실행 여부를 확인하세요.');}
 }
 return {open,patch,flush,sync,reset};
}
