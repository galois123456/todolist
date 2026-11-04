import test from 'node:test';
import assert from 'node:assert/strict';
import {notesFixture} from './notes-fixture.js';
import {appColors} from '../app-colors.js';

test('메모함 전환, 16색 자동 저장, 확대 편집 후 원위치 복귀',async()=>{
 const f=notesFixture();try{
  await f.app.open();assert.equal(f.visible().length,1);
  const card=f.visible()[0],palette=card.querySelector('.paper-palette');
  for(let i=0;i<appColors.length;i++){palette.children[i].onclick();await f.app.flush();assert.equal(f.data.todo_notes.find(n=>n.id==='note').color,appColors[i][0]);}
  const input=card.querySelector('textarea'),expand=card.querySelector('.expand-note');
  expand.onclick();assert.equal(document.querySelector('.note-expanded').open,true);
  input.value='확대 화면에서 수정';input.dispatchEvent(new f.window.Event('input'));await f.app.flush();
  expand.onclick();assert.equal(document.querySelector('.note-expanded').open,false);
  assert.equal(f.visible()[0],card);assert.equal(input.value,'확대 화면에서 수정');
  assert.equal('text_style' in f.calls.filter(c=>c.mode==='update').at(-1).values,false);
  f.choose('hidden');assert.equal(f.visible()[0].querySelector('textarea').value,'기존 숨김');
  assert.equal(f.$('notesTitle').textContent,'숨김 메모함');
  f.choose('general');assert.equal(f.visible()[0].querySelector('textarea').value,'확대 화면에서 수정');
 }finally{f.close();}
});

test('메모함 만들기·이름 변경·중복 거부·안전한 텍스트 출력',async()=>{
 const f=notesFixture();try{
  await f.app.open();f.manage();await f.folder('  수업 준비  ');
  const folder=f.data.todo_note_folders.find(x=>x.name==='수업 준비');
  assert.ok(folder);assert.equal(f.$('noteFolderSelect').value,folder.id);
  await f.folder('수업 준비');assert.match(f.$('noteFolderError').textContent,/같은 이름/);
  await f.renameFolder(folder.id,'<img src=x onerror=alert(1)>');
  assert.equal(f.$('noteFolderList').querySelector('img'),null);
  assert.equal(f.$('notesTitle').textContent,'<img src=x onerror=alert(1)>');
  f.$('closeNoteFolders').onclick();
  await f.$('newNote').onclick();assert.equal(f.visible().length,1);
  assert.equal(f.data.todo_notes[0].folder_id,folder.id);
  assert.equal(f.data.todo_notes[0].body,'');assert.equal(f.$('noteFolderSelect').selectedOptions[0].textContent.includes('(1)'),true);
  f.app.reset();await f.app.open();assert.equal(f.$('noteFolderSelect').value,folder.id);
 }finally{f.close();}
});

test('이동 실패 보존·이동 성공 후 기존 메모함에서 제외·확대 상태 이동',async()=>{
 const f=notesFixture();try{
  await f.app.open();const card=f.visible()[0];card.querySelector('.expand-note').onclick();
  f.fail(c=>c.mode==='update' && !!c.values.folder_id);
  await f.move(card,'hidden');
  assert.equal(document.querySelector('.note-expanded').open,false);
  assert.equal(card.hidden,false);assert.equal(f.data.todo_notes.find(n=>n.id==='note').folder_id,'general');
  assert.match(f.$('noteMoveError').textContent,/실패/);
  f.fail(null);await f.$('noteMoveForm').onsubmit({preventDefault(){}});
  assert.equal(card.hidden,true);f.choose('hidden');assert.equal(f.visible().length,2);
  assert.equal(f.data.todo_notes.length,2);
  assert.equal(f.data.todo_notes.find(n=>n.id==='note').body,'기존 내용');
  f.app.reset();await f.app.open();assert.equal(f.visible().length,2);
 }finally{f.close();}
});

test('이동 중 늦게 끝나는 자동 저장은 메모함을 되돌리지 않는다',async()=>{
 const f=notesFixture();try{
  await f.app.open();const card=f.visible()[0],input=card.querySelector('textarea');
  let release,started;const began=new Promise(r=>started=r);
  f.before(async c=>{if(c.mode==='update' && 'body' in c.values){started();await new Promise(r=>release=r);}});
  input.value='최신 내용';input.dispatchEvent(new f.window.Event('input'));
  const pending=f.app.flush();await began;await f.move(card,'hidden');
  release();await pending;
  const saved=f.data.todo_notes.find(n=>n.id==='note');assert.equal(saved.folder_id,'hidden');assert.equal(saved.body,'최신 내용');
  assert.equal(f.calls.filter(c=>c.values?.body).every(c=>!('folder_id' in c.values)),true);
 }finally{f.close();}
});

test('메모함 삭제: 확인 취소·서버 실패 보존·성공 시 메모/임시본 함께 제거',async()=>{
 const f=notesFixture();try{
  await f.app.open();f.manage();
  f.confirm(false);await f.removeFolder('general');assert.equal(f.data.todo_note_folders.length,2);
  assert.match(f.confirmation(),/일반 메모함/);assert.match(f.confirmation(),/1개/);assert.match(f.confirmation(),/영구 삭제/);
  f.confirm(true);f.fail(c=>c.mode==='delete');await f.removeFolder('general');
  assert.equal(f.data.todo_note_folders.length,2);assert.equal(f.data.todo_notes.length,2);assert.match(f.$('noteFolderError').textContent,/실패/);
  localStorage.setItem('school-todo-note-draft-owner-note','{"body":"draft","color":"yellow"}');
  f.fail(null);await f.removeFolder('general');
  assert.equal(f.data.todo_notes.length,1);assert.equal(f.data.todo_notes[0].id,'hidden-note');
  assert.equal(localStorage.getItem('school-todo-note-draft-owner-note'),null);
  assert.equal(f.$('noteFolderSelect').value,'hidden');
  await f.removeFolder('hidden');assert.equal(f.data.todo_notes.length,0);assert.equal(f.data.todo_note_folders.length,0);
  assert.equal(f.$('newNote').disabled,true);assert.equal(f.$('manageNoteFolders').disabled,false);
  f.app.reset();await f.app.open();assert.equal(f.data.todo_note_folders.length,0);
  f.manage();await f.folder('다시 시작');assert.equal(f.$('newNote').disabled,false);
 }finally{f.close();}
});

test('계정 전환 뒤 늦게 도착한 생성 응답을 새 계정에 표시하지 않음',async()=>{
 const f=notesFixture();try{
  await f.app.open();f.manage();let release,started;const began=new Promise(r=>started=r);
  f.before(async c=>{if(c.mode==='insert'){started();await new Promise(r=>release=r);}});
  const pending=f.folder('이전 계정');await began;f.app.reset();f.user({id:'other'});
  await f.app.open();release();await pending;
  assert.equal(f.$('noteFolderSelect').options.length,1);assert.equal(f.$('noteFolderSelect').value,'');
  assert.equal(f.$('noteFolderList').textContent.includes('이전 계정'),false);
  assert.equal(f.calls.filter(c=>c.mode==='insert').at(-1).values.user_id,'owner');
 }finally{f.close();}
});

test('추가 SQL 미실행 시 안내하고 새 메모·메모함 저장은 잠금',async()=>{
 const f=notesFixture();try{
  const fail=c=>c.table==='todo_note_folders';fail.code='PGRST205';f.fail(fail);
  await f.app.open();assert.match(f.$('notesMessage').textContent,/현재버전_추가.sql/);
  assert.equal(f.$('newNote').disabled,true);assert.equal(f.$('manageNoteFolders').disabled,true);
  f.fail(null);await f.$('retryNotes').onclick();assert.equal(f.$('newNote').disabled,false);
 }finally{f.close();}
});

test('빈 계정은 메모함을 먼저 만들고, 이동 대상이 없으면 이동을 막음',async()=>{
 const f=notesFixture({folderRows:[],noteRows:[]});try{
  await f.app.open();assert.equal(f.$('newNote').disabled,true);f.manage();await f.folder('첫 메모함');f.$('closeNoteFolders').onclick();
  await f.$('newNote').onclick();f.visible()[0].querySelector('.move-note').onclick();
  assert.equal(f.$('confirmNoteMove').disabled,true);assert.match(f.$('noteMoveError').textContent,/먼저 만들어/);
 }finally{f.close();}
});

test('메모함 500개 이상은 페이지로 전부 읽고 계정별로만 조회',async()=>{
 const folders=Array.from({length:501},(_,i)=>({id:'folder-'+i,name:'메모함 '+i,user_id:'owner',created_at:'2026-11-04'}));
 const f=notesFixture({folderRows:folders,noteRows:[]});try{
  await f.app.open();assert.equal(f.$('noteFolderSelect').options.length,501);
  assert.equal(f.calls.filter(c=>c.table==='todo_note_folders' && c.mode==='read').length,2);
  assert.equal(f.calls.every(c=>c.filters.user_id==='owner'),true);
 }finally{f.close();}
});

test('메모함 삭제는 진행 중 자동 저장 뒤에 실행하며 삭제 후 메모를 되살리지 않음',async()=>{
 const f=notesFixture();try{
  await f.app.open();const input=f.visible()[0].querySelector('textarea');
  let release,started;const began=new Promise(r=>started=r);
  f.before(async c=>{if(c.mode==='update' && 'body' in c.values){started();await new Promise(r=>release=r);}});
  input.value='저장 중';input.dispatchEvent(new f.window.Event('input'));const save=f.app.flush();await began;
  f.manage();const deletion=f.removeFolder('general');
  assert.equal(f.calls.filter(c=>c.mode==='delete').length,0);
  assert.equal(input.disabled,true);assert.equal(f.$('newNote').disabled,true);
  release();await save;await deletion;await f.app.flush();
  assert.equal(f.data.todo_notes.some(n=>n.id==='note'),false);
  assert.equal(localStorage.getItem('school-todo-note-draft-owner-note'),null);
  assert.equal(f.calls.at(-1).table,'todo_note_folders');assert.equal(f.calls.at(-1).mode,'delete');
 }finally{f.close();}
});

test('개별 메모 삭제 실패 시 편집 가능 상태로 복원하고 다른 메모는 유지',async()=>{
 const f=notesFixture();try{
  await f.app.open();const card=f.visible()[0];f.fail(c=>c.mode==='delete');
  await card.querySelector('.remove-note').onclick();
  assert.equal(card.querySelector('textarea').disabled,false);assert.equal(f.data.todo_notes.length,2);
  f.fail(null);await card.querySelector('.remove-note').onclick();
  assert.equal(f.data.todo_notes.length,1);assert.equal(f.data.todo_note_folders.length,2);
  assert.equal(f.data.todo_notes[0].id,'hidden-note');
 }finally{f.close();}
});
