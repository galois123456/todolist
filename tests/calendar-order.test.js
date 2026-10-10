import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {compareTasks} from '../task-filters.js';
import {calendarWeek} from '../calendar-week.js';
const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');
const calendar=source.slice(source.indexOf('function renderCalendar()'),source.indexOf('let lastCalendarTap'));
const tasks=[
 {id:'a',title:'나 일정',category_id:'external',priority:'low',start_date:'2026-10-01',due_date:'2026-10-12',created_at:'2026-10-02'},
 {id:'b',title:'가 일정',category_id:'school',priority:'high',start_date:'2026-10-03',due_date:'2026-10-10',created_at:'2026-10-01'},
 {id:'c',title:'다 일정',category_id:'personal',priority:'medium',start_date:null,due_date:null,created_at:'2026-10-03'},
 {id:'d',title:'완료 일정',category_id:'school',priority:'high',due_date:'2026-10-01',completed:true}
];
const categories=[{id:'school'},{id:'external'},{id:'personal'}];
const expected={due:['b','a','c','d'],start:['a','b','c','d'],priority:['b','c','a','d'],new:['c','a','b','d'],title:['b','a','c','d'],category:['b','a','c','d']};
test('모든 정렬 기준을 캘린더와 Selected Day에 동일하게 적용하며 완료는 마지막',()=>{
 for(const [sort,ids] of Object.entries(expected)){
  assert.deepEqual([...tasks].sort((a,b)=>compareTasks(a,b,sort,categories)).map(t=>t.id),ids);
  const nodes={sort:{value:sort}};const $=id=>nodes[id]??(nodes[id]={});
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const ctx={$,state:{tasks,categories,month:new Date(2026,9,1),selected:'2026-10-04'},weekStart:'monday',calendarWeek,localDate,loadHolidays:()=>{},holidayYears:new Map(),taskOnDay:()=>true,compareTasks,parseLocal:v=>new Date(v+'T12:00:00'),escapeHtml:v=>v,categoryStyle:()=>'',categoryName:()=>'',priorityName:{},dateTimeLabel:()=>''};
  vm.createContext(ctx);vm.runInContext(calendar+'\nrenderCalendar();',ctx);
  const agendaIds=[...nodes.agendaList.innerHTML.matchAll(/data-edit="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(agendaIds,ids);
  const titles=[...nodes.calendarGrid.innerHTML.matchAll(/class="calendar-task[^\"]*" title="([^"]+)"/g)].slice(0,2).map(m=>m[1]);assert.deepEqual(titles,ids.slice(0,2).map(id=>tasks.find(t=>t.id===id).title));
 }
});
