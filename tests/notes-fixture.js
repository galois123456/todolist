import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createNotes} from '../notes.js';

export function notesFixture({folderRows,noteRows}={}) {
  const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://test.invalid'});
  const {window}=dom;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  const prior={};for(const k of ['document','window','localStorage','confirm'])prior[k]=globalThis[k];
  Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage});
  let confirmed=true,confirmation='',user={id:'owner'};
  globalThis.confirm=text=>{confirmation=text;return confirmed;};
  const now='2026-11-04T12:00:00Z';
  const data={
    todo_note_folders:folderRows || [{id:'general',user_id:'owner',name:'일반 메모함',legacy_key:'general',created_at:now},{id:'hidden',user_id:'owner',name:'숨김 메모함',legacy_key:'hidden',created_at:now}],
    todo_notes:noteRows || [{id:'note',user_id:'owner',folder_id:'general',body:'기존 내용',color:'yellow',created_at:now,is_hidden:false},{id:'hidden-note',user_id:'owner',folder_id:'hidden',body:'기존 숨김',color:'pink',created_at:now,is_hidden:true}]
  };
  for(const [table,rows] of Object.entries(data)) {
    const groups=new Map();
    for(const row of rows) {
      const key=row.user_id+(table==='todo_notes' ? ':'+row.folder_id : '');
      if(!groups.has(key))groups.set(key,[]); groups.get(key).push(row);
    }
    for(const group of groups.values())group.sort((a,b)=>
      (String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id))*(table==='todo_notes'?-1:1)
    ).forEach((row,i)=>{row.sort_order??=i+1;});
  }
  const calls=[];let fail=null,beforeWrite=null,serial=0;
  const rank=(table,owner,folder)=>{
    const rows=data[table].filter(r=>r.user_id===owner && (table!=='todo_notes' || r.folder_id===folder));
    return table==='todo_notes' ? Math.min(1,...rows.map(r=>r.sort_order))-1 : Math.max(0,...rows.map(r=>r.sort_order))+1;
  };
  const db={from(table){
    let mode='read',values=null,filters={},range=null,single=false,order=[];
    const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(k,v){order.push([k,v]);return q;},range(a,b){range=[a,b];return q;},update(v){mode='update';values=v;return q;},insert(v){mode='insert';values=v;return q;},delete(){mode='delete';return q;},single(){single=true;return q;},then(resolve,reject){
      return (async()=>{
        const call={table,mode,values,filters,range};calls.push(call);
        if(beforeWrite && mode!=='read')await beforeWrite(call);
        if(fail?.(call))return {error:{code:fail.code || 'offline',message:'테스트 통신 오류'}};
        let rows=(data[table]||[]).filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
        if(mode==='insert'){
          if(table==='todo_notes' && !data.todo_note_folders.some(f=>f.id===values.folder_id && f.user_id===values.user_id))return {error:{code:'23503'}};
          rows=[{id:'new-'+(++serial),created_at:new Date().toISOString(),...values,sort_order:rank(table,values.user_id,values.folder_id)}];data[table].unshift(...rows);
        }
        if(mode==='update'){
          if(values.folder_id && !data.todo_note_folders.some(f=>f.id===values.folder_id && f.user_id===filters.user_id))return {error:{code:'23503'}};
          rows.forEach(row=>{if(values.folder_id && row.folder_id!==values.folder_id)row.sort_order=rank(table,row.user_id,values.folder_id);Object.assign(row,values);});
        }
        if(mode==='delete'){
          data[table]=data[table].filter(row=>!rows.includes(row));
          if(table==='todo_note_folders')data.todo_notes=data.todo_notes.filter(n=>!rows.some(f=>f.id===n.folder_id && f.user_id===n.user_id));
        }
        for(const [k,{ascending}] of order.toReversed()) rows.sort((a,b)=>(k==='sort_order'?a[k]-b[k]:String(a[k]).localeCompare(String(b[k])))*(ascending?1:-1));
        if(range)rows=rows.slice(range[0],range[1]+1);
        if(single && rows.length!==1)return {error:{code:'PGRST116'}};
        return {data:structuredClone(single?rows[0]:rows)};
      })().then(resolve,reject);
    }};return q;
  }};
  db.rpc=async(name,values)=>{
    const table=values.p_folder_id===null?'todo_note_folders':'todo_notes';
    const call={table,mode:'rpc',name,values,filters:{user_id:user?.id}};calls.push(call);
    if(beforeWrite)await beforeWrite(call);
    if(fail?.(call))return {error:{code:fail.code || 'offline',message:'테스트 통신 오류'}};
    const current=data[table].filter(r=>r.user_id===call.filters.user_id && (table!=='todo_notes' || r.folder_id===values.p_folder_id)).sort((a,b)=>a.sort_order-b.sort_order);
    if(JSON.stringify(current.map(r=>r.id))!==JSON.stringify(values.p_expected_ids))return {error:{code:'40001',message:'다른 기기에서 목록 또는 순서가 변경되었습니다. 다시 불러온 뒤 시도하세요.'}};
    if(values.p_ids.length!==current.length || new Set(values.p_ids).size!==current.length || !values.p_ids.every(id=>current.some(r=>r.id===id)))return {error:{code:'22023',message:'Invalid order'}};
    values.p_ids.forEach((id,i)=>{current.find(r=>r.id===id).sort_order=i+1;});
    return {data:{ids:values.p_ids}};
  };
  const app=createNotes({db,getUser:()=>user}),$=id=>document.getElementById(id);
  return {app,$,window,data,calls,
    cards:()=>[...$('notesGrid').children],
    visible:()=>[...$('notesGrid').children].filter(c=>!c.hidden),
    choose(id){$('noteFolderSelect').value=id;$('noteFolderSelect').onchange();},
    manage(){ $('manageNoteFolders').onclick(); },
    async folder(name){$('noteFolderName').value=name;await $('noteFolderForm').onsubmit({preventDefault(){}});},
    async removeFolder(id){await $('noteFolderList').onclick({target:$('noteFolderList').querySelector(`[data-folder-delete="${id}"]`)});},
    async renameFolder(id,name){await $('noteFolderList').onclick({target:$('noteFolderList').querySelector(`[data-folder-rename="${id}"]`)});await this.folder(name);},
    async stepFolder(id,step){await $('noteFolderList').onclick({target:$('noteFolderList').querySelector(`[data-folder-id="${id}"][data-folder-step="${step}"]`)});},
    async move(card,id){card.querySelector('.move-note').onclick();$('noteMoveTarget').value=id;await $('noteMoveForm').onsubmit({preventDefault(){}});},
    confirm(value){confirmed=value;},confirmation:()=>confirmation,
    fail(fn){fail=fn;},before(fn){beforeWrite=fn;},user(value){user=value;},
    close(){app.reset();dom.window.close();Object.assign(globalThis,prior);}
  };
}
