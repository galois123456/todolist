import test from 'node:test';import assert from 'node:assert/strict';import {createSaveStatus} from '../save-status.js';
test('조회는 저장 완료가 아니며 동시 저장은 모두 끝나야 완료',async()=>{
 let state;const jobs=[];const m=createSaveStatus({onChange:s=>state=s.state,fetcher:()=>new Promise(resolve=>jobs.push(resolve))});
 const read=m.fetch('https://x/rest/v1/todo_tasks');assert.equal(state,'idle');jobs.shift()({ok:true});await read;
 const a=m.fetch('https://x/rest/v1/todo_tasks',{method:'POST'}),b=m.fetch('https://x/rest/v1/todo_notes',{method:'PATCH'});assert.equal(state,'saving');jobs.shift()({ok:true});await a;assert.equal(state,'saving');jobs.shift()({ok:true});await b;assert.equal(state,'saved');
});
test('실패 유지·같은 작업 재시도·로그아웃 이전 응답 무시',async()=>{
 let state,ok=false;const m=createSaveStatus({onChange:s=>state=s.state,fetcher:async()=>({ok})});
 await m.fetch('https://x/rest/v1/todo_tasks',{method:'PATCH'});assert.equal(state,'error');ok=true;await m.fetch('https://x/rest/v1/todo_notes',{method:'POST'});assert.equal(state,'error');await m.fetch('https://x/rest/v1/todo_tasks',{method:'PATCH'});assert.equal(state,'saved');
 let finish;const old=createSaveStatus({onChange:s=>state=s.state,fetcher:()=>new Promise(r=>finish=r)});const p=old.fetch('https://x/rest/v1/todo_tasks',{method:'POST'});old.reset();finish({ok:true});await p;assert.equal(state,'idle');
});

test('저장 일시는 성공에만 갱신하고 실패 때 보존하며 로그아웃 때 제거',async()=>{
 let value,ok=true;const m=createSaveStatus({onChange:s=>value=s,fetcher:async()=>({ok})});
 assert.equal(value.savedAt,'');await m.fetch('https://x/rest/v1/todo_tasks');assert.equal(value.savedAt,'');
 await m.fetch('https://x/rest/v1/todo_tasks',{method:'PATCH'});assert.ok(value.savedAt);assert.match(value.savedLabel,/\d{4}/);const saved=value.savedAt;
 ok=false;await m.fetch('https://x/rest/v1/todo_tasks',{method:'PATCH'});assert.equal(value.savedAt,saved);m.reset();assert.equal(value.savedAt,'');
});
