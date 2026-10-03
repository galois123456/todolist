import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimetable } from '../timetable.js';
test('설정 저장·재접속, 날짜별 세부사항 저장과 주 이동', async()=>{
 const nodes=new Map();const original=globalThis.document, oldConfirm=globalThis.confirm; globalThis.confirm=()=>true;
 globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);}};
 const records={todo_timetables:null,todo_timetable_details:[]};let lastWrite;
 const db={from(table){let values=null,filters={},deleting=false;const chain={select(){return chain;},delete(){deleting=true;return chain;},eq(k,v){filters[k]=v;return chain;},gte(){return chain;},lte(){return chain;},upsert(v){values=structuredClone(v);return chain;},maybeSingle(){return Promise.resolve({data:records[table]});},single(){lastWrite={table,values};if(table==='todo_timetables')records[table]=values;else records[table].push(values);return Promise.resolve({data:values});},then(resolve,reject){if(deleting){lastWrite={table,filters};records[table]=records[table].filter(r=>!Object.entries(filters).every(([k,v])=>r[k]===v));}return Promise.resolve({data:records[table]}).then(resolve,reject);}};return chain;}};
 const $=id=>globalThis.document.getElementById(id);
 try{
 const app=createTimetable({db,getUser:()=>({id:'owner'}),getWeekStart:()=> 'monday'});await app.open();
 $('timetableEdit').onclick();$('timetableAddRow').onclick();
 await $('timetableSave').onclick();assert.equal(lastWrite.table,'todo_timetables');assert.equal(lastWrite.values.user_id,'owner');
 const rowId=lastWrite.values.template.rows[0].id;
 app.reset();await app.open();assert.match($('timetableTable').innerHTML,/1교시/);
 $('timetableTable').onclick({target:{closest:selector=>selector==='[data-row-cell]'?{dataset:{rowCell:rowId,date:'2026-10-03',weekday:'6'}}:null}});
 $('timetableDetail').value='수행평가';await $('timetableCellForm').onsubmit({preventDefault(){}});
 assert.deepEqual({...lastWrite.values,updated_at:null},{user_id:'owner',row_id:rowId,entry_date:'2026-10-03',body:'수행평가',updated_at:null});
 assert.match($('timetableDetailsList').innerHTML,/수행평가/);
 await $('timetableDetailsList').onclick({target:{closest:selector=>selector==='[data-detail-edit]'?{dataset:{detailEdit:rowId,detailDate:'2026-10-03'}}:null}});
 assert.equal($('timetableDetail').value,'수행평가');$('timetableDetail').value='평가 변경';await $('timetableCellForm').onsubmit({preventDefault(){}});
 assert.match($('timetableDetailsList').innerHTML,/평가 변경/);
 await $('timetableDetailsList').onclick({target:{closest:selector=>selector==='[data-detail-delete]'?{dataset:{detailDelete:rowId,detailDate:'2026-10-03'}}:null}});
 assert.equal(lastWrite.filters.user_id,'owner');assert.equal(lastWrite.filters.entry_date,'2026-10-03');assert.doesNotMatch($('timetableDetailsList').innerHTML,/평가 변경/);
 $('timetableNext').onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch($('timetableTable').innerHTML,/수행평가/);
 app.reset();
 }finally{globalThis.document=original;globalThis.confirm=oldConfirm;}
});
