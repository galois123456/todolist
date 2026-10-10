// Observe actual database writes; reads, holiday requests and auth do not imply a save.
export function createSaveStatus({onChange,fetcher=(...args)=>globalThis.fetch(...args)}){
 let generation=0,pending=0,lastSaved=null;
 const failures=new Set();
 function render(){
  const state=pending?'saving':failures.size?'error':lastSaved?'saved':'idle';
  const text={saving:'서버 저장 중…',error:'서버 저장 실패',saved:'서버 저장 완료',idle:'서버 저장 대기'}[state];
  const time=lastSaved?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(lastSaved):'';
  onChange({state,text,title:(time?`최근 서버 저장: ${time}. `:'')+'실제 서버 저장 요청 결과입니다. 일정·시간표 편집은 저장 버튼을 눌러야 저장됩니다.'+(failures.size?' 실패한 작업을 다시 저장하세요.':'')});
 }
 async function trackedFetch(input,init){
  const url=typeof input==='string'?input:input.url||String(input);
  const method=(init?.method||input?.method||'GET').toUpperCase();
  if(!url.includes('/rest/v1/')||!['POST','PATCH','PUT','DELETE'].includes(method))return fetcher(input,init);
  const token=generation,key=method+' '+url;pending++;render();
  try{
   const response=await fetcher(input,init);
   if(token===generation){if(response.ok){failures.delete(key);lastSaved=new Date();}else failures.add(key);}
   return response;
  }catch(error){if(token===generation)failures.add(key);throw error;}
  finally{if(token===generation){pending--;render();}}
 }
 function reset(){generation++;pending=0;lastSaved=null;failures.clear();render();}
 render();return {fetch:trackedFetch,reset};
}
