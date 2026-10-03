import { weekDays, detailKey, normalizeTemplate, timetableColors } from './timetable-model.js';
export function createTimetable({db,getUser,getWeekStart}) {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const checked = result => { if(result.error) throw result.error; return result.data; };
  let owner=null, generation=0, template={rows:[]}, draft=null, details=new Map(), anchor=new Date(), loaded=false, editing=false, loading=false, saving=false, cellTarget=null, loadSequence=0, weekLoading=false;
  const message = text => { $('timetableMessage').textContent=text; };
  const current = () => editing ? draft : template;
  function reset() { generation++; loadSequence++; owner=null; loaded=false; weekLoading=false; loading=false; editing=false; saving=false; draft=null; template={rows:[]}; details.clear(); anchor=new Date(); cellTarget=null; $('timetableCellDialog').close(); $('timetableTable').innerHTML=''; }
  function render() {
    if(!owner) return;
    const days=weekDays(anchor,getWeekStart()), rows=current().rows;
    $('timetableWeekLabel').textContent=`${days[0].date} ~ ${days[6].date}`;
    $('timetableSetup').hidden=!editing; $('timetableHint').hidden=editing;
    $('timetableEdit').hidden=editing; $('timetableEdit').disabled=!loaded || saving;
    $('timetableAddRow').disabled=saving; $('timetableSave').disabled=saving; $('timetableCancel').disabled=saving;
    $('timetableTable').innerHTML=`<thead><tr><th scope="col">교시 · 시간</th>${days.map(d=>`<th scope="col" class="${d.weekday===0?'sunday':d.weekday===6?'saturday':''}">${'일월화수목금토'[d.weekday]}<small>${d.label}</small></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${editing?`<input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="label" aria-label="행 이름" maxlength="40" value="${escape(row.label)}"><input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="start" aria-label="시작 시간" type="time" value="${escape(row.start)}"><input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="end" aria-label="종료 시간" type="time" value="${escape(row.end)}"><button type="button" class="text-button" data-remove-row="${escape(row.id)}">행 삭제</button>`:`<strong>${escape(row.label || '이름 없음')}</strong><small>${escape([row.start,row.end].filter(Boolean).join(' ~ '))}</small>`}</th>${days.map(d=>{const cell=row.cells[d.weekday] || {}, note=details.get(detailKey(row.id,d.date)) || '', color=timetableColors.find(([key])=>key===cell.color)?.[2] || '#fff';return `<td><button type="button" class="timetable-cell" style="--cell-color:${color}" data-row-cell="${escape(row.id)}" data-date="${d.date}" data-weekday="${d.weekday}" ${saving || !loaded || (!editing && weekLoading)?'disabled':''}><strong>${escape(cell.subject)}</strong><span>${escape(cell.room)}</span>${!editing&&note?`<small class="timetable-detail-preview">${escape(note)}</small>`:''}<span class="cell-placeholder">${editing?'설정':!cell.subject&&!cell.room&&!note?'＋':''}</span></button></td>`;}).join('')}</tr>`).join('')}</tbody>`;
    if(loaded && !rows.length) message('시간표 설정을 눌러 행을 추가하세요.');
  }
  async function loadWeek() {
    if(!loaded) return;
    const userId=owner, token=generation, seq=++loadSequence, days=weekDays(anchor,getWeekStart());
    weekLoading=true; render(); message('날짜별 세부사항을 불러오는 중…');
    try {
      const records=checked(await db.from('todo_timetable_details').select('*').eq('user_id',userId).gte('entry_date',days[0].date).lte('entry_date',days[6].date));
      if(token!==generation || seq!==loadSequence) return;
      weekLoading=false; details=new Map(records.map(r=>[detailKey(r.row_id,r.entry_date),r.body])); message(''); $('timetableRetry').hidden=true; render();
    } catch(error) { if(token===generation && seq===loadSequence){ message(`세부사항 조회 실패: ${error.message}`); $('timetableRetry').hidden=false; } }
  }
  async function open() {
    const user=getUser(); if(!user || !db) return;
    if(owner!==user.id){reset();owner=user.id;}
    if(loaded){render();await loadWeek();return;}
    if(loading)return;
    loading=true; const token=generation; message('시간표를 불러오는 중…'); render();
    try {
      const record=checked(await db.from('todo_timetables').select('*').eq('user_id',owner).maybeSingle());
      if(token!==generation)return;
      template=normalizeTemplate(record?.template); loaded=true; message(''); render(); await loadWeek();
    }catch(error){if(token===generation){message(`시간표 조회 실패: ${error.message} · ver1.14 SQL 실행 여부를 확인하세요.`);$('timetableRetry').hidden=false;}}
    finally{if(token===generation)loading=false;}
  }
  $('timetableEdit').onclick=()=>{if(!loaded)return;draft=structuredClone(template);editing=true;message('');render();};
  $('timetableCancel').onclick=()=>{editing=false;draft=null;message('');render();};
  $('timetableAddRow').onclick=()=>{if(!editing || saving)return;if(draft.rows.length>=100){message('행은 최대 100개까지 추가할 수 있습니다.');return;}draft.rows.push({id:crypto.randomUUID(),label:`${draft.rows.length+1}교시`,start:'',end:'',cells:{}});render();};
  $('timetableTable').oninput=e=>{if(!editing || saving)return;const row=draft.rows.find(r=>r.id===e.target.dataset.row);if(row && ['label','start','end'].includes(e.target.dataset.field))row[e.target.dataset.field]=e.target.value;};
  $('timetableSave').onclick=async()=>{
    if(!editing || saving)return;
    if(draft.rows.some(r=>r.start && r.end && r.start>r.end)){message('종료 시간은 시작 시간보다 빠를 수 없습니다.');return;}
    const token=generation, userId=owner, snapshot=normalizeTemplate(draft);saving=true;render();
    try{checked(await db.from('todo_timetables').upsert({user_id:userId,template:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('user_id').single());if(token!==generation)return;template=snapshot;draft=null;editing=false;message('시간표 설정을 저장하고 고정했습니다.');}
    catch(error){if(token===generation)message(`설정 저장 실패: ${error.message}`);}
    finally{if(token===generation){saving=false;render();}}
  };
  $('timetableTable').onclick=e=>{
    if(saving || !loaded || (!editing && weekLoading))return;
    const remove=e.target.closest('[data-remove-row]');
    if(remove && editing){if(confirm('이 행을 시간표에서 삭제할까요?')){draft.rows=draft.rows.filter(r=>r.id!==remove.dataset.removeRow);render();}return;}
    const button=e.target.closest('[data-row-cell]');if(!button)return;
    const row=current().rows.find(r=>r.id===button.dataset.rowCell);if(!row)return;
    cellTarget={rowId:row.id,date:button.dataset.date,day:Number(button.dataset.weekday),editing,generation};
    const cell=row.cells[cellTarget.day] || {};
    $('timetableCellTitle').textContent=editing?`${'일월화수목금토'[cellTarget.day]} · ${row.label} 설정`:`${cellTarget.date} · ${row.label}`;
    $('timetableBaseFields').hidden=!editing;$('timetableDetailField').hidden=editing;
    $('timetableRoom').value=cell.room || '';$('timetableSubject').value=cell.subject || '';$('timetableColor').value=cell.color || 'white';
    $('timetableDetail').value=details.get(detailKey(row.id,cellTarget.date)) || '';$('timetableCellError').textContent='';$('timetableCellDialog').showModal();
  };
  $('timetableColor').innerHTML=timetableColors.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  $('timetableCellCancel').onclick=()=>$('timetableCellDialog').close();
  $('timetableCellForm').onsubmit=async e=>{
    e.preventDefault();if(!cellTarget || cellTarget.generation!==generation)return;
    const target={...cellTarget};
    if(target.editing){const row=draft.rows.find(r=>r.id===target.rowId);if(row)row.cells[target.day]={room:$('timetableRoom').value.trim(),subject:$('timetableSubject').value.trim(),color:$('timetableColor').value};$('timetableCellDialog').close();render();return;}
    const userId=owner, body=$('timetableDetail').value.trim();$('timetableCellSave').disabled=true;$('timetableCellCancel').disabled=true;
    try{checked(await db.from('todo_timetable_details').upsert({user_id:userId,row_id:target.rowId,entry_date:target.date,body,updated_at:new Date().toISOString()},{onConflict:'user_id,row_id,entry_date'}).select('row_id').single());if(target.generation!==generation)return;details.set(detailKey(target.rowId,target.date),body);$('timetableCellDialog').close();message('해당 날짜의 세부사항을 저장했습니다.');render();}
    catch(error){if(target.generation===generation)$('timetableCellError').textContent=`저장 실패: ${error.message}`;}
    finally{$('timetableCellSave').disabled=false;$('timetableCellCancel').disabled=false;}
  };
  function move(amount){anchor.setDate(anchor.getDate()+amount);details.clear();render();loadWeek();}
  $('timetablePrev').onclick=()=>move(-7);$('timetableNext').onclick=()=>move(7);$('timetableToday').onclick=()=>{anchor=new Date();details.clear();render();loadWeek();};
  $('timetableRetry').onclick=()=>loaded?loadWeek():open();
  return {open,reset,canLeave:()=>!saving && (!editing || confirm('저장하지 않은 시간표 설정이 있습니다. 화면을 이동할까요?')),render:()=>{render();if(loaded)loadWeek();}};
}
