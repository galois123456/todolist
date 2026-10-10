import test from 'node:test';import assert from 'node:assert/strict';
import {createPreferences} from '../preferences.js';
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
function server(){const rows=new Map();let fail=false;return {rows,set fail(v){fail=v;},db(id){return {rpc:async(name,{p_patch})=>{if(fail)return {error:new Error('offline')};const next={...rows.get(id),...p_patch};rows.set(id,next);return {data:next};},from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return fail?{error:new Error('offline')}:{data:rows.has(id)?{settings:{...rows.get(id)}}:null};}})};}};}
test('계정별 필터·테마 저장, 다른 기기 복원, 변경한 필드만 병합',async()=>{
 const s=server();let a,b;
 const first=createPreferences({db:s.db('a'),storage:storage(),onApply:v=>a=v});
 const second=createPreferences({db:s.db('a'),storage:storage(),onApply:v=>b=v});
 await first.open('a');first.patch({theme:'dark',sort:'category',sourceFilter:'schedule-1',statusFilter:'fiveDays',search:'행사',categoryFilter:'school'});await first.flush();
 await first.flush();first.patch({statusFilter:'sevenDays'});await first.flush();await second.open('a');assert.equal(b.theme,'dark');assert.equal(b.sourceFilter,'schedule-1');assert.equal(b.statusFilter,'sevenDays');
 second.patch({theme:'light'});await second.flush();first.patch({sort:'title'});await first.flush();await second.sync();assert.equal(b.theme,'light');assert.equal(b.sort,'title');
 let other;const third=createPreferences({db:s.db('b'),storage:storage(),onApply:v=>other=v});await third.open('b');assert.equal(other.search,'');assert.equal(other.theme,'system');
 first.reset();second.reset();third.reset();
});
test('오프라인 변경은 재실행 후 재시도, 로그아웃한 계정의 응답 무시',async()=>{
 const s=server(),local=storage();let value,status;
 const a=createPreferences({db:s.db('a'),storage:local,onApply:v=>value=v,onStatus:v=>status=v});await a.open('a');s.fail=true;a.patch({theme:'dark',search:'수학'});await assert.rejects(()=>a.flush());assert.match(status,/동기화 실패/);a.reset();
 s.fail=false;const b=createPreferences({db:s.db('a'),storage:local,onApply:v=>value=v});await b.open('a');assert.equal(value.search,'수학');assert.equal(s.rows.get('a').theme,'dark');b.reset();
 let resolve;const c=createPreferences({db:{from:()=>({select(){return this;},eq(){return this;},maybeSingle(){return new Promise(r=>resolve=r);}})},storage:storage(),onApply:v=>value=v});
 const opening=c.open('a');await new Promise(r=>setImmediate(r));c.reset();resolve({data:{settings:{theme:'dark',search:'previous-account'}}});await opening;assert.notEqual(value.search,'previous-account');
});
