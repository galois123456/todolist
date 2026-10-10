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
