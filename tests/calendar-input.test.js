import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('PC 새 일정만 마감일 채우기, 모바일·기존 수정·저장 중·음력 보호',()=>{
 const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');const code=source.slice(source.indexOf('let lastCalendarTap'),source.indexOf("$('agendaList').onclick"));
 for(const [desktop,editId,loading,lunar,expected] of [[true,null,false,false,'2026-10-15'],[false,null,false,false,'2026-10-12'],[true,'id',false,false,'2026-10-12'],[true,null,true,false,'2026-10-12'],[true,null,false,true,'2026-10-12']]){
 const nodes={calendarGrid:{},taskDue:{value:'2026-10-12'},taskLunar:{checked:lunar}};const ctx={$:id=>nodes[id],desktopLayout:{matches:desktop},state:{editId,loading,selected:'2026-10-12'},parseLocal:s=>new Date(s+'T12:00:00'),renderCalendar(){},syncDateLimits(){},showNotice(){}};vm.createContext(ctx);vm.runInContext(code,ctx);nodes.calendarGrid.onclick({target:{closest:()=>({dataset:{date:'2026-10-15'}})}});assert.equal(nodes.taskDue.value,expected);assert.equal(ctx.state.selected,'2026-10-15');
 }
});
