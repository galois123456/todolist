import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('async function submitTask('),source.indexOf("$('deleteTask').onclick"));
function setup({completed=false,fail=false,attachmentError=false}={}){
 const nodes={taskForm:{reportValidity:()=>true},completeTask:{},taskError:{}};const writes=[];let resets=0;
 const ctx={$:id=>nodes[id],state:{loading:false,editId:'task',user:{id:'owner'},tasks:[{id:'task',completed}]},readTaskForm:()=>({title:'수정 제목',category_id:'school',note:'수정 내용'}),attachments:{read:()=>{if(attachmentError)throw new Error('첨부자료 로딩 중');return {links:[{url:'https://example.com'}],photos:[]};}},busy:value=>{ctx.state.loading=value;},db:{from:()=>({update:values=>{writes.push(values);const chain={eq:()=>chain,select:()=>chain,single:async()=>({error:fail?new Error('저장 실패'):null})};return chain;}})},checked:r=>{if(r.error)throw r.error;},loadData:async()=>{},prepareTask:()=>resets++,switchView:()=>{},showNotice:()=>{},errorText:e=>e.message};
 vm.createContext(ctx);vm.runInContext(handler,ctx);
 return {ctx,nodes,writes,resets:()=>resets,submit:id=>(id==='completeTask'?nodes.completeTask.onclick:nodes.taskForm.onsubmit)({preventDefault(){}})};
}
test('완료와 되돌리기는 수정 내용 및 첨부자료와 함께 저장한다',async()=>{
 for(const completed of [false,true]){const t=setup({completed});await t.submit('completeTask');assert.equal(t.writes[0].completed,!completed);assert.equal(t.writes[0].title,'수정 제목');assert.equal(t.writes[0].attachments.links.length,1);assert.equal(t.resets(),1);assert.equal(t.ctx.state.loading,false);}
});
test('일반 저장은 완료 상태를 변경하지 않고 실패하면 편집 내용을 유지한다',async()=>{
 const normal=setup({completed:true});await normal.submit('saveTask');assert.equal('completed' in normal.writes[0],false);
 const failure=setup({fail:true});await failure.submit('completeTask');assert.equal(failure.resets(),0);assert.equal(failure.nodes.taskError.textContent,'저장 실패');assert.equal(failure.ctx.state.loading,false);
 const pending=setup({attachmentError:true});await pending.submit('completeTask');assert.equal(pending.writes.length,0);assert.equal(pending.resets(),0);
});
