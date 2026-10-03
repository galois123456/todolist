import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimetable } from '../timetable.js';
test('설정 저장·재접속, 날짜별 세부사항 저장과 주 이동', async()=>{
 const nodes=new Map();const original=globalThis.document;
 globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);}};
 const records={todo_timetables:null,todo_timetable_details:[]};let lastWrite;
 const db={from(table){let values=null,filters={};const chain={select(){return chain;},eq(k,v){filters[k]=v;return chain;},gte(){return chain;},lte(){return chain;},upsert(v){values=structuredClone(v);return chain;},maybeSingle(){return Promise.resolve({data:records[table]});},single(){lastWrite={table,values};if(table==='todo_timetables')records[table]=values;else records[table].push(values);return Promise.resolve({data:values});},then(resolve,reject){return Promise.resolve({data:records[table]}).then(resolve,reject);}};return chain;}};
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
 $('timetableNext').onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch($('timetableTable').innerHTML,/수행평가/);
 app.reset();
 }finally{globalThis.document=original;}
});
