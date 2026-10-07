import test from 'node:test';import assert from 'node:assert/strict';
import {dueInPeriod,compareCategories} from '../task-filters.js';
test('분야 등록 순서 우선, 같은 분야는 마감일, 미분류는 마지막',()=>{
 const categories=[{id:'school'},{id:'external'},{id:'personal'}];
 const tasks=['personal','external','school','unknown'].map(category_id=>({category_id,title:'일정'}));
 assert.deepEqual(tasks.sort((a,b)=>compareCategories(a,b,categories)).map(t=>t.category_id),['school','external','personal','unknown']);
});
test('주·월 전체 및 오늘 포함 3일, 완료·미정 제외, 연말 경계',()=>{
 const matches=(due,period,today='2026-10-07',week='monday')=>dueInPeriod({due_date:due},period,today,week);
 assert.ok(matches('2026-10-05','week'));assert.ok(matches('2026-10-11','week'));assert.ok(!matches('2026-10-12','week'));
 assert.ok(matches('2026-10-04','week','2026-10-07','sunday'));assert.ok(!matches('2026-10-11','week','2026-10-07','sunday'));
 assert.ok(matches('2026-10-01','month'));assert.ok(matches('2026-10-31','month'));assert.ok(!matches('2026-11-01','month'));
 for(const date of ['2026-10-07','2026-10-08','2026-10-09'])assert.ok(matches(date,'threeDays'));
 assert.ok(!matches('2026-10-06','threeDays'));assert.ok(!matches('2026-10-10','threeDays'));
 assert.ok(matches('2027-01-01','threeDays','2026-12-30'));
 assert.ok(!dueInPeriod({completed:true,due_date:'2026-10-07'},'today','2026-10-07'));
 assert.ok(!dueInPeriod({start_date:'2026-10-07'},'month','2026-10-07'));
 assert.ok(dueInPeriod({yearly_repeat:true,due_date:'2025-10-08'},'threeDays','2026-10-07'));
 assert.ok(dueInPeriod({is_lunar:true,lunar_due:'2025-01-01',yearly_repeat:true},'month','2026-02-01'));
});
