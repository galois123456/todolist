import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDays, detailKey, normalizeTemplate } from '../timetable-model.js';
test('주 시작 순서와 연말·윤년 주 날짜',()=>{
 const monday=weekDays(new Date(2027,0,1),'monday'), sunday=weekDays(new Date(2027,0,1),'sunday');
 assert.equal(monday[0].date,'2026-12-28');assert.equal(monday[6].date,'2027-01-03');assert.equal(sunday[0].date,'2026-12-27');
 assert.equal(weekDays(new Date(2028,1,29),'monday')[1].date,'2028-02-29');
});
test('고정 시간표는 요일로 유지하고 세부사항은 날짜와 행으로 구분',()=>{
 const rows=[{id:'row',label:'점심',cells:{2:{subject:'수학',room:'3-1',color:'pink'}}}];
 const template=normalizeTemplate({rows});const first=weekDays(new Date(2026,9,6),'monday')[1], next=weekDays(new Date(2026,9,13),'sunday')[2];
 assert.equal(template.rows[0].cells[first.weekday].subject,template.rows[0].cells[next.weekday].subject);
 assert.notEqual(detailKey('row',first.date),detailKey('row',next.date));
 assert.notEqual(detailKey('row',first.date),detailKey('other',first.date));
 assert.equal(normalizeTemplate({rows:[{id:'x',cells:{0:{color:'url(bad)'}}}]}).rows[0].cells[0].color,'white');
});
