import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {notesFixture} from './notes-fixture.js';

test('메모 도구 네 개와 짧은 모바일 라벨, 관리/순서 편집의 접근성 이름을 유지',async()=>{
 const rows=['a','b'].map((id,i)=>({id,user_id:'owner',folder_id:'general',body:id,color:'yellow',created_at:'2026-11-05',sort_order:i+1}));
 const f=notesFixture({noteRows:rows});try{
  await f.app.open();
  assert.deepEqual([...document.querySelector('.notes-toolbar').children].map(el=>el.id),['newNote','noteFolderSelect','manageNoteFolders','editNoteOrder']);
  const manage=f.$('manageNoteFolders'),order=f.$('editNoteOrder');
  assert.equal(manage.getAttribute('aria-label'),'메모함 관리');assert.equal(manage.querySelector('.toolbar-label-short').textContent,'관리 ⚙');assert.equal(manage.querySelector('.toolbar-label-full').textContent,'메모함 관리 ⚙');
  assert.equal(order.getAttribute('aria-label'),'↕ 순서 편집');assert.equal(order.querySelector('.toolbar-label-short').textContent,'↕ 순서');
  order.onclick();assert.equal(order.getAttribute('aria-label'),'✓ 순서 편집 완료');assert.equal(order.querySelector('.toolbar-label-short').textContent,'✓ 완료');
  await f.visible()[0].querySelector('.note-order-next').onclick();assert.equal(f.visible()[0].dataset.orderId,'b');
  order.onclick();assert.equal(order.getAttribute('aria-pressed'),'false');assert.equal(order.querySelector('.toolbar-label-full').textContent,'↕ 순서 편집');
  f.manage();assert.equal(document.querySelector('.note-folder-dialog').open,true);assert.equal(f.$('noteFolderSelect').selectedOptions[0].textContent,'일반 메모함 (2)');
 }finally{f.close();}
});

test('모바일 툴바는 가변 폭 메모함을 사이에 둔 4열이며 PC 전체 이름과 선택창 16px 유지',()=>{
 const css=readFileSync(new URL('../notes.css',import.meta.url),'utf8');
 const mobile=css.slice(css.lastIndexOf('@media(max-width:760px){'));
 assert.match(mobile,/grid-template-columns:auto minmax\(0,1fr\) auto auto/);
 assert.match(mobile,/\.toolbar-label-full\{display:none\}/);assert.match(mobile,/\.toolbar-label-short\{display:inline\}/);
 assert.match(mobile,/\.note-folder-select\{[^}]*min-width:0[^}]*font-size:16px/);
 assert.match(mobile,/#manageNoteFolders\{grid-column:auto/);assert.match(mobile,/#editNoteOrder\{grid-column:auto/);
 assert.match(css,/\.notes-toolbar \.toolbar-label-short\{display:none\}/);
});
