import test from 'node:test';
import assert from 'node:assert/strict';
import { shareText, validateTimes } from '../schedule-share.js';
test('공유에는 제목, 선택적인 날짜·시간과 내용만 포함',()=>{
 const task={title:'강의',note:'Zoom 강의',category_id:'private',priority:'high',start_date:'2026-10-14',due_date:'2026-10-14',start_time:'14:00:00',due_time:'14:50:00'};
 assert.equal(shareText(task),'강의\n날짜: 2026-10-14 14:00 ~ 2026-10-14 14:50\nZoom 강의');
 assert.equal(shareText({...task,start_date:null,start_time:null}),'강의\n날짜: 2026-10-14 14:50\nZoom 강의');
 assert.equal(shareText({...task,start_date:null,due_date:null}),'강의\nZoom 강의');
});
test('반복 일정은 선택한 해와 연도 경계의 실제 날짜를 공유',()=>{
 assert.match(shareText({title:'새해',yearly_repeat:true,start_date:'2026-12-30',due_date:'2027-01-02'},'2028-01-01'),/2027-12-30 ~ 2028-01-02/);
 assert.match(shareText({title:'반복 시작',yearly_repeat:true,start_date:'2026-01-01'},'2028-10-03'),/2028-01-01/);
 assert.match(shareText({title:'음력 설',yearly_repeat:true,is_lunar:true,lunar_due:'2026-01-01',due_date:'2026-02-17'},'2027-02-07'),/2027-02-07/);
});
test('날짜 없는 시간, 잘못된 시간, 같은 날 역전 시간을 거부',()=>{
 assert.throws(()=>validateTimes({}, {start_time:'14:00'},{}));
 assert.throws(()=>validateTimes({}, {start_time:'25:00'},{start:'2026-10-03'}));
 assert.throws(()=>validateTimes({}, {start_time:'15:00',due_time:'14:00'},{start:'2026-10-03',due:'2026-10-03'}));
 assert.doesNotThrow(()=>validateTimes({}, {start_time:'15:00',due_time:'14:00'},{start:'2026-10-03',due:'2026-10-04'}));
});
