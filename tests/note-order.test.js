import test from 'node:test';
import assert from 'node:assert/strict';
import {notesFixture} from './notes-fixture.js';
import {movedIds} from '../note-order.js';

const three = () => ['a','b','c'].map((id,i)=>({id,user_id:'owner',folder_id:'general',body:'메모 '+id,color:'yellow',created_at:'2026-11-04',sort_order:i+1}));
const visibleIds = f => f.visible().map(el=>el.dataset.orderId);
const serverIds = (f,table,folder) => f.data[table].filter(r=>r.user_id==='owner' && (!folder || r.folder_id===folder)).sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.id);

test('순서 계산: 앞/뒤/처음/마지막 이동, 원본 보존, 범위 밖 무시',()=>{
 const ids=['a','b','c','d'];
 assert.deepEqual(movedIds(ids,'a',3),['b','c','d','a']);
 assert.deepEqual(movedIds(ids,'d',0),['d','a','b','c']);
 assert.deepEqual(movedIds(ids,'b',2),['a','c','b','d']);
 for(const [id,index] of [['x',0],['b',-1],['b',9],['b',1]])assert.deepEqual(movedIds(ids,id,index),ids);
 assert.deepEqual(ids,['a','b','c','d']);
});

test('메모함 위/아래 이동을 한 RPC로 저장하고 선택·내용은 유지, 재접속 순서 복원',async()=>{
 const f=notesFixture();try{
  await f.app.open();f.manage();
  assert.equal(f.$('noteFolderList').querySelector('[data-folder-id="general"][data-folder-step="-1"]').disabled,true);
  await f.stepFolder('general',1);
  assert.deepEqual([...f.$('noteFolderSelect').options].map(o=>o.value),['hidden','general']);
  assert.equal(f.$('noteFolderSelect').value,'general');assert.equal(f.visible()[0].querySelector('textarea').value,'기존 내용');
  assert.equal(f.calls.filter(c=>c.mode==='rpc').length,1);
  assert.deepEqual(f.calls.at(-1).values,{p_folder_id:null,p_ids:['hidden','general'],p_expected_ids:['general','hidden']});
  f.app.reset();await f.app.open();assert.deepEqual([...f.$('noteFolderSelect').options].map(o=>o.value),['hidden','general']);
  f.manage();await f.folder('새 메모함');assert.equal([...f.$('noteFolderSelect').options].at(-1).textContent,'새 메모함 (0)');
 }finally{f.close();}
});

test('메모 순서 편집: 입력·확대·이동·색 변경은 잠그고 앞/뒤로 저장, 완료 후 편집 복원',async()=>{
 const f=notesFixture({noteRows:three()});try{
  await f.app.open();assert.deepEqual(visibleIds(f),['a','b','c']);
  const first=f.visible()[0],last=f.visible()[2],input=first.querySelector('textarea');
  input.value='정렬 전 수정';input.dispatchEvent(new f.window.Event('input'));
  f.$('editNoteOrder').onclick();assert.equal(f.$('editNoteOrder').getAttribute('aria-pressed'),'true');
  assert.equal(input.disabled,true);assert.equal(first.querySelector('details').inert,true);
  assert.equal(f.$('newNote').disabled,true);assert.equal(first.querySelector('.note-order-prev').disabled,true);assert.equal(last.querySelector('.note-order-next').disabled,true);
  await first.querySelector('.note-order-next').onclick();assert.deepEqual(visibleIds(f),['b','a','c']);
  assert.deepEqual(serverIds(f,'todo_notes','general'),['b','a','c']);
  await f.app.flush();assert.equal(f.data.todo_notes.find(n=>n.id==='a').body,'정렬 전 수정');
  assert.equal(f.calls.filter(c=>c.mode==='update').every(c=>!('sort_order' in c.values)),true);
  f.$('editNoteOrder').onclick();assert.equal(input.disabled,false);assert.equal(f.$('newNote').disabled,false);assert.equal(first.querySelector('.note-order-bar').hidden,true);
  f.app.reset();await f.app.open();assert.deepEqual(visibleIds(f),['b','a','c']);
  await f.$('newNote').onclick();assert.match(visibleIds(f)[0],/^new-/);
 }finally{f.close();}
});

test('순서 저장 실패는 화면·서버 순서를 바꾸지 않고 재시도 가능',async()=>{
 const f=notesFixture({noteRows:three()});try{
  await f.app.open();f.$('editNoteOrder').onclick();const original=f.visible()[0];
  f.fail(c=>c.mode==='rpc');await original.querySelector('.note-order-next').onclick();
  assert.deepEqual(visibleIds(f),['a','b','c']);assert.deepEqual(serverIds(f,'todo_notes','general'),['a','b','c']);assert.match(f.$('noteOrderStatus').textContent,/실패/);
  assert.equal(f.$('editNoteOrder').disabled,false);assert.equal(original.querySelector('.note-order-next').disabled,false);
  f.fail(null);await original.querySelector('.note-order-next').onclick();assert.deepEqual(visibleIds(f),['b','a','c']);
  f.manage();f.fail(c=>c.mode==='rpc');await f.stepFolder('general',1);assert.deepEqual(serverIds(f,'todo_note_folders'),['general','hidden']);
  assert.match(f.$('noteFolderOrderStatus').textContent,/실패/);
 }finally{f.close();}
});

function pointer(f,target,type,x,y,extra={}) {
 const event=new f.window.Event(type,{bubbles:true,cancelable:true});
 for(const [k,v] of Object.entries({pointerId:1,clientX:x,clientY:y,button:0,isPrimary:true,...extra}))Object.defineProperty(event,k,{value:v});
 target.dispatchEvent(event);return event;
}
function rectangles(elements) {
 elements.forEach((el,i)=>{el.getBoundingClientRect=()=>({left:0,right:300,top:i*160,bottom:i*160+150,width:300,height:150});});
}
function dragClock(f) {f.window.requestAnimationFrame=()=>1;f.window.cancelAnimationFrame=()=>{};f.window.scrollBy=()=>{};}
const settled=()=>new Promise(resolve=>setImmediate(resolve));

test('메모 손잡이 끌기: 임계 거리 후 목표 표시, 놓으면 저장하고 표시 제거',async()=>{
 const f=notesFixture({noteRows:three()});try{
  dragClock(f);await f.app.open();f.$('editNoteOrder').onclick();const cards=f.visible();rectangles(cards);
  const handle=cards[0].querySelector('.order-handle');
  pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',51,51);assert.equal(cards[0].classList.contains('order-dragging'),false);
  const move=pointer(f,handle,'pointermove',150,400);
  assert.equal(move.defaultPrevented,true);assert.equal(cards[2].classList.contains('order-drop-target'),true);
  assert.match(document.querySelector('.note-order-drag-label').textContent,/3번째/);
  pointer(f,handle,'pointerup',150,400);await settled();assert.deepEqual(visibleIds(f),['b','c','a']);
  assert.equal(document.querySelector('.note-order-drag-label'),null);assert.equal(document.querySelector('.order-dragging'),null);assert.equal(document.querySelector('.order-drop-target'),null);
  assert.deepEqual(serverIds(f,'todo_notes','general'),['b','c','a']);
 }finally{f.close();}
});

test('메모함 끌기는 모달 안에서 동작하며 취소/Escape/숨겨진 항목/일반 입력은 순서를 바꾸지 않음',async()=>{
 const f=notesFixture({noteRows:three()});try{
  dragClock(f);await f.app.open();f.manage();let rows=[...f.$('noteFolderList').children];rectangles(rows);
  const handle=rows[0].querySelector('.order-handle');
  pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',150,210);
  assert.ok(document.querySelector('.note-folder-dialog .note-order-drag-label'));
  pointer(f,handle,'pointercancel',150,210);await settled();assert.deepEqual(serverIds(f,'todo_note_folders'),['general','hidden']);
  pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',150,210);
  handle.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  pointer(f,handle,'pointerup',150,210);await settled();assert.equal(f.calls.filter(c=>c.mode==='rpc').length,0);
  pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',150,210);pointer(f,handle,'pointerup',150,210);await settled();assert.deepEqual(serverIds(f,'todo_note_folders'),['hidden','general']);
  f.$('closeNoteFolders').onclick();const input=f.visible()[0].querySelector('textarea');
  pointer(f,input,'pointerdown',50,50);pointer(f,input,'pointermove',150,400);pointer(f,input,'pointerup',150,400);await settled();assert.deepEqual(visibleIds(f),['a','b','c']);
  assert.equal(f.calls.filter(c=>c.mode==='rpc').length,1);
 }finally{f.close();}
});

test('끌기 도중 목록 전환/계정 초기화는 동작과 표시를 취소',async()=>{
 const f=notesFixture({noteRows:three()});try{
  dragClock(f);await f.app.open();f.$('editNoteOrder').onclick();const cards=f.visible();rectangles(cards);const handle=cards[0].querySelector('.order-handle');
  pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',150,400);
  f.choose('hidden');assert.equal(document.querySelector('.note-order-drag-label'),null);
  pointer(f,handle,'pointerup',150,400);await settled();assert.equal(f.calls.filter(c=>c.mode==='rpc').length,0);
  f.choose('general');f.$('editNoteOrder').onclick();pointer(f,handle,'pointerdown',50,50);pointer(f,handle,'pointermove',150,400);
  f.app.reset();assert.equal(document.querySelector('.note-order-drag-label'),null);assert.equal(f.$('notesGrid').children.length,0);
 }finally{f.close();}
});

test('다른 기기의 순서/목록 변경은 충돌 안내 후 다시 불러오기로 복원',async()=>{
 const f=notesFixture({noteRows:three()});try{
  await f.app.open();f.$('editNoteOrder').onclick();
  f.data.todo_notes.find(n=>n.id==='a').sort_order=4;
  await f.visible()[0].querySelector('.note-order-next').onclick();
  assert.match(f.$('noteOrderStatus').textContent,/다른 기기/);assert.deepEqual(visibleIds(f),['a','b','c']);
  await f.$('retryNotes').onclick();assert.deepEqual(visibleIds(f),['b','c','a']);assert.equal(f.$('editNoteOrder').getAttribute('aria-pressed'),'false');
  f.data.todo_notes.push({id:'new-external',user_id:'owner',folder_id:'general',sort_order:0,body:'다른 기기에서 생성',color:'blue',created_at:'2026-11-04'});
  f.$('editNoteOrder').onclick();await f.visible()[0].querySelector('.note-order-next').onclick();
  assert.match(f.$('noteOrderStatus').textContent,/다시 불러/);await f.$('retryNotes').onclick();assert.equal(visibleIds(f)[0],'new-external');
 }finally{f.close();}
});

test('저장 중 중복 클릭/다른 이동을 차단하고 계정 전환 후 늦은 응답을 무시',async()=>{
 const f=notesFixture({noteRows:three()});try{
  await f.app.open();f.$('editNoteOrder').onclick();let release,started;const began=new Promise(r=>started=r);
  f.before(async c=>{if(c.mode==='rpc'){started();await new Promise(r=>release=r);}});
  const a=f.visible()[0],pending=a.querySelector('.note-order-next').onclick();await began;
  assert.equal(f.$('editNoteOrder').disabled,true);assert.equal(f.$('noteFolderSelect').disabled,true);
  await a.querySelector('.note-order-next').onclick();assert.equal(f.calls.filter(c=>c.mode==='rpc').length,1);
  f.app.reset();f.user({id:'other'});await f.app.open();release();await pending;
  assert.equal(f.visible().length,0);assert.equal(f.$('noteOrderStatus').textContent,'');
 }finally{f.close();}
});

test('이동한 메모는 대상 메모함 맨 앞으로, 기존 메모 순서는 유지',async()=>{
 const f=notesFixture({noteRows:[...three(),{id:'h',user_id:'owner',folder_id:'hidden',body:'숨김',color:'red',created_at:'2026-11-04',sort_order:1}]});try{
  await f.app.open();await f.move(f.visible()[1],'hidden');f.choose('hidden');assert.deepEqual(visibleIds(f),['b','h']);
  f.$('editNoteOrder').onclick();await f.visible()[0].querySelector('.note-order-next').onclick();assert.deepEqual(visibleIds(f),['h','b']);
  f.choose('general');assert.equal(f.$('editNoteOrder').getAttribute('aria-pressed'),'false');assert.deepEqual(visibleIds(f),['a','c']);
  f.visible()[0].querySelector('.expand-note').onclick();assert.equal(document.querySelector('.note-expanded').open,true);f.$('editNoteOrder').onclick();assert.equal(document.querySelector('.note-expanded').open,false);
 }finally{f.close();}
});

test('한 장/빈 메모함에서 순서 편집은 비활성, RPC 미설치 시 버전 파일명 안내',async()=>{
 const f=notesFixture();try{
  await f.app.open();assert.equal(f.$('editNoteOrder').disabled,true);f.manage();
  const missing=c=>c.mode==='rpc';missing.code='PGRST202';f.fail(missing);await f.stepFolder('general',1);assert.match(f.$('noteFolderOrderStatus').textContent,/ver1.44까지_통합.sql/);
  assert.deepEqual(serverIds(f,'todo_note_folders'),['general','hidden']);
 }finally{f.close();}
});

test('늦게 완료되는 본문 자동 저장이 정렬 결과를 되돌리지 않고 수정 내용도 보존',async()=>{
 const f=notesFixture({noteRows:three()});try{
  await f.app.open();const card=f.visible()[0],input=card.querySelector('textarea');
  let release,started;const began=new Promise(r=>started=r);
  f.before(async c=>{if(c.mode==='update' && 'body' in c.values){started();await new Promise(r=>release=r);}});
  input.value='늦은 저장 내용';input.dispatchEvent(new f.window.Event('input'));const pending=f.app.flush();await began;
  f.$('editNoteOrder').onclick();await card.querySelector('.note-order-next').onclick();release();await pending;
  assert.deepEqual(serverIds(f,'todo_notes','general'),['b','a','c']);assert.equal(f.data.todo_notes.find(n=>n.id==='a').body,'늦은 저장 내용');
 }finally{f.close();}
});
