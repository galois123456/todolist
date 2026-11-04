import { createAutoSaver } from './note-autosave.js';
import { appColors } from './app-colors.js';
import { attachOrderDrag, movedIds } from './note-order.js';
const paperColors = appColors;

export function createNotes({ db, getUser }) {
  const $ = id => document.getElementById(id);
  const grid = $('notesGrid'), message = $('notesMessage'), add = $('newNote'), retry = $('retryNotes');
  const choose = $('noteFolderSelect'), manage = $('manageNoteFolders'), title = $('notesTitle');
  const orderButton = $('editNoteOrder'), orderHelp = $('noteOrderHelp'), orderStatus = $('noteOrderStatus');
  let owner = null, loaded = false, loading = false, generation = 0, busy = false;
  let folders = [], selectedId = '', editingId = null, movingId = null;
  let orderMode = false;
  const records = new Map();
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const checked = result => { if (result.error) throw result.error; return result.data; };
  const alive = (token, userId) => token === generation && userId === owner && userId === getUser()?.id;
  const storageKey = () => `school-todo-note-folder-${owner}`;
  const draftKey = id => `school-todo-note-draft-${owner}-${id}`;
  function cache(key, value) { try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch {} }
  const noteError = error => {
    if (['42P01','42703','42883','PGRST202','PGRST204','PGRST205'].includes(error?.code))
      return 'Supabase에서 ver1.44까지_통합.sql을 실행한 뒤 다시 불러오기를 누르세요. 이미 적용했다면 배포 파일과 연결 프로젝트도 확인하세요.';
    if (error?.code === '23505') return '같은 이름의 메모함이 있습니다.';
    if (error?.code === '23503' || error?.code === 'PGRST116') return '다른 기기에서 메모 또는 메모함이 변경·삭제되었을 수 있습니다. 다시 불러오기를 눌러 주세요.';
    return error?.message || '인터넷 연결을 확인한 뒤 다시 시도하세요.';
  };

  const expanded = document.createElement('dialog');
  expanded.className = 'note-expanded'; expanded.setAttribute('aria-label','메모 크게 보기'); document.body.append(expanded);
  let expandedCard = null;
  function closeExpanded() {
    if (!expandedCard) return;
    const {element,placeholder,button} = expandedCard; expandedCard = null;
    placeholder.replaceWith(element); button.textContent = '확대'; button.setAttribute('aria-label','메모 크게 보기');
    if (expanded.open) expanded.close();
    button.focus({preventScroll:true});
  }
  expanded.addEventListener('close',()=>{if (!expanded.open) closeExpanded();});
  expanded.addEventListener('cancel',event=>{event.preventDefault(); if (!busy) closeExpanded();});

  const manager = document.createElement('dialog');
  manager.className = 'note-folder-dialog'; manager.setAttribute('aria-labelledby','noteFolderManagerTitle');
  manager.innerHTML = '<div class="note-folder-dialog-body"><div class="dialog-heading"><h2 id="noteFolderManagerTitle">메모함 관리</h2><button id="closeNoteFolders" type="button" class="text-button">닫기</button></div><p class="note-order-help">손잡이를 끌거나 ↑·↓ 버튼으로 순서를 바꾸세요.</p><div id="noteFolderList" class="note-folder-list"></div><p id="noteFolderOrderStatus" class="note-order-status" role="status"></p><form id="noteFolderForm"><label for="noteFolderName" id="noteFolderNameLabel">새 메모함 이름</label><input id="noteFolderName" maxlength="40" required placeholder="예: 수업 준비, 개인 메모" autocomplete="off"><div class="dialog-actions"><button id="cancelNoteFolderEdit" type="button" class="button secondary" hidden>이름 변경 취소</button><button id="saveNoteFolder" type="submit" class="button primary">＋ 메모함 만들기</button></div></form><p id="noteFolderError" class="form-message" role="alert"></p></div>';
  document.body.append(manager);
  const moveDialog = document.createElement('dialog');
  moveDialog.className = 'note-folder-dialog'; moveDialog.setAttribute('aria-labelledby','noteMoveTitle');
  moveDialog.innerHTML = '<form id="noteMoveForm" class="note-folder-dialog-body"><h2 id="noteMoveTitle">다른 메모함으로 이동</h2><p id="noteMoveFrom" class="muted"></p><label for="noteMoveTarget">보낼 메모함</label><select id="noteMoveTarget" required></select><p id="noteMoveError" class="form-message" role="alert"></p><div class="dialog-actions"><button id="cancelNoteMove" type="button" class="button secondary">취소</button><button id="confirmNoteMove" type="submit" class="button primary">이동</button></div></form>';
  document.body.append(moveDialog);

  for (const dialog of [manager,moveDialog]) dialog.addEventListener('cancel',event=>{if (busy) event.preventDefault();});
  $('closeNoteFolders').onclick = () => { if (!busy) manager.close(); };
  $('cancelNoteMove').onclick = () => { if (!busy) moveDialog.close(); };

  function controls() {
    add.disabled = busy || orderMode || !loaded || !selectedId;
    choose.disabled = busy || !loaded || !folders.length;
    manage.disabled = busy || !loaded;
    orderButton.disabled = busy || !loaded || (!orderMode && orderedNotes().length<2);
    const orderLabel=orderMode ? '✓ 순서 편집 완료' : '↕ 순서 편집';
    orderButton.innerHTML = `<span class="toolbar-label-full">${orderLabel}</span><span class="toolbar-label-short" aria-hidden="true">${orderMode?'✓ 완료':'↕ 순서'}</span>`;
    orderButton.setAttribute('aria-label',orderLabel);
    orderButton.title=orderLabel;
    orderButton.setAttribute('aria-pressed',String(orderMode));
    orderHelp.hidden = !orderMode;
    grid.classList.toggle('notes-order-editing',orderMode);
    retry.disabled = busy || loading;
    for (const {element} of records.values()) {
      element.querySelectorAll('button,select,input,textarea').forEach(c=>c.disabled=busy || (orderMode && !c.closest('.note-order-bar')));
      element.querySelector('.note-order-bar').hidden = !orderMode;
      element.querySelectorAll('details').forEach(d=>{if(orderMode || busy)d.open=false;d.inert=orderMode || busy;});
    }
    for (const dialog of [manager,moveDialog]) dialog.querySelectorAll('button,input,select').forEach(c=>c.disabled=busy);
    $('confirmNoteMove').disabled = busy || !$('noteMoveTarget').value;
    const visible = orderedNotes();
    visible.forEach((r,i)=>{
      r.element.querySelector('.note-order-position').textContent = `${i+1} / ${visible.length}`;
      r.element.querySelector('.note-order-prev').disabled = busy || i===0;
      r.element.querySelector('.note-order-next').disabled = busy || i===visible.length-1;
    });
    $('noteFolderList').querySelectorAll('[data-folder-step]').forEach(b=>{
      const i=folders.findIndex(f=>f.id===b.dataset.folderId), next=i+Number(b.dataset.folderStep);
      b.disabled=busy || next<0 || next>=folders.length;
    });
  }
  const compareOrder = (a,b,descending=false) => Number(a.sort_order)-Number(b.sort_order)
    || (String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id))*(descending?-1:1);
  function orderedNotes() { return [...records.values()].filter(r=>r.note.folder_id===selectedId).sort((a,b)=>compareOrder(a.note,b.note,true)); }
  function setBusy(value) { busy = value; controls(); }
  function rememberSelection() { try { localStorage.setItem(storageKey(),selectedId); } catch {} }
  function emptyMessage() {
    const count = [...records.values()].filter(r=>r.note.folder_id===selectedId).length;
    message.textContent = count ? '' : folders.length ? '이 메모함은 비어 있습니다. 새 메모를 만들어 보세요.' : '메모함 관리에서 첫 메모함을 만들어 주세요.';
  }
  function updateView() {
    folders.sort((a,b)=>compareOrder(a,b));
    if (!folders.some(f=>f.id===selectedId)) selectedId = folders[0]?.id || '';
    const counts = new Map();
    for (const {note} of records.values()) counts.set(note.folder_id,(counts.get(note.folder_id)||0)+1);
    choose.innerHTML = folders.length ? folders.map(f=>`<option value="${escape(f.id)}">${escape(f.name)} (${counts.get(f.id)||0})</option>`).join('') : '<option value="">메모함 없음</option>';
    choose.value = selectedId;
    title.textContent = folders.find(f=>f.id===selectedId)?.name || '나의 메모장';
    records.forEach(r=>{r.element.hidden = r.note.folder_id !== selectedId;});
    orderedNotes().forEach(r=>{if(expandedCard?.element!==r.element)grid.append(r.element);});
    if (owner) rememberSelection();
    emptyMessage(); renderFolderList(); controls();
  }
  choose.onchange = () => { if (busy) return; noteDrag.cancel(); closeExpanded(); orderMode=false; orderStatus.textContent=''; selectedId = choose.value; updateView(); };
  orderButton.onclick = () => {
    if (busy || !loaded) return;
    noteDrag.cancel(); closeExpanded(); orderMode=!orderMode; orderStatus.textContent=''; controls();
  };
  async function reorder(kind,id,targetIndex) {
    if (busy || !loaded || owner!==getUser()?.id || (kind==='notes' && !orderMode)) return;
    const list=kind==='folders' ? folders : orderedNotes().map(r=>r.note);
    const ids=list.map(r=>r.id), next=movedIds(ids,id,targetIndex);
    if (next.every((id,i)=>id===ids[i])) return;
    const token=generation,userId=owner,folderId=selectedId;
    const status=kind==='folders' ? $('noteFolderOrderStatus') : orderStatus;
    status.dataset.state='saving'; status.textContent='순서 저장 중…'; setBusy(true);
    try {
      checked(await db.rpc('todo_set_note_order',{p_folder_id:kind==='folders'?null:folderId,p_ids:next,p_expected_ids:ids}));
      if (!alive(token,userId)) return;
      next.forEach((id,i)=>{list.find(r=>r.id===id).sort_order=i+1;});
      updateView(); status.dataset.state='saved'; status.textContent='순서를 저장했습니다.';
    } catch (error) {
      if (alive(token,userId)) { status.dataset.state='error'; status.textContent=`순서 저장 실패: ${noteError(error)}`; retry.hidden=false; }
    } finally {
      if (alive(token,userId)) {
        setBusy(false);
        const item=kind==='folders' ? [...$('noteFolderList').children].find(el=>el.dataset.orderId===id) : records.get(id)?.element;
        item?.querySelector('.order-handle')?.focus({preventScroll:true});
      }
    }
  }
  function clearFolderEdit() {
    editingId = null; $('noteFolderName').value = ''; $('noteFolderNameLabel').textContent = '새 메모함 이름';
    $('saveNoteFolder').textContent = '＋ 메모함 만들기'; $('cancelNoteFolderEdit').hidden = true; $('noteFolderError').textContent = '';
  }
  $('cancelNoteFolderEdit').onclick = clearFolderEdit;
  function renderFolderList() {
    $('noteFolderList').innerHTML = folders.length ? folders.map(folder=>{
      const count = [...records.values()].filter(r=>r.note.folder_id===folder.id).length;
      return `<div class="note-folder-row" data-order-id="${escape(folder.id)}"><button type="button" class="order-handle" aria-label="${escape(folder.name)} 순서 끌어서 이동" title="손잡이로 끌어서 순서 변경 · 키보드는 옆 위/아래 버튼 사용">⠿</button><div class="note-folder-info"><strong>${escape(folder.name)}</strong><small>메모 ${count}개</small></div><div class="note-folder-order"><button type="button" class="order-step" data-folder-id="${escape(folder.id)}" data-folder-step="-1" aria-label="${escape(folder.name)} 위로 이동">↑</button><button type="button" class="order-step" data-folder-id="${escape(folder.id)}" data-folder-step="1" aria-label="${escape(folder.name)} 아래로 이동">↓</button></div><div class="note-folder-actions"><button type="button" class="text-button" data-folder-rename="${escape(folder.id)}">이름 변경</button><button type="button" class="text-button note-folder-delete" data-folder-delete="${escape(folder.id)}">삭제</button></div></div>`;
    }).join('') : '<p class="muted">아래에서 새 메모함을 만드세요.</p>';
  }
  manage.onclick = () => {
    if (!loaded || busy) return;
    noteDrag.cancel(); orderMode=false;
    $('noteFolderOrderStatus').textContent='';
    closeExpanded(); clearFolderEdit(); renderFolderList(); manager.showModal(); $('noteFolderName').focus(); controls();
  };
  $('noteFolderForm').onsubmit = async event => {
    event.preventDefault();
    if (busy || !loaded || !getUser() || getUser().id!==owner) return;
    const name = $('noteFolderName').value.trim();
    if (!name || [...name].length>40) { $('noteFolderError').textContent = '메모함 이름을 1~40자로 입력하세요.'; return; }
    if (folders.some(f=>f.id!==editingId && f.name===name)) { $('noteFolderError').textContent = '같은 이름의 메모함이 있습니다.'; return; }
    const token = generation, userId = owner, id = editingId;
    setBusy(true); $('noteFolderError').textContent = '';
    try {
      const folder = id
        ? checked(await db.from('todo_note_folders').update({name}).eq('id',id).eq('user_id',userId).select('*').single())
        : checked(await db.from('todo_note_folders').insert({user_id:userId,name}).select('*').single());
      if (!alive(token,userId)) return;
      if (id) folders = folders.map(f=>f.id===id ? folder : f);
      else { folders.push(folder); selectedId = folder.id; }
      clearFolderEdit(); updateView();
    } catch (error) { if (alive(token,userId)) { $('noteFolderError').textContent = noteError(error); retry.hidden = false; } }
    finally { if (alive(token,userId)) setBusy(false); }
  };
  $('noteFolderList').onclick = async event => {
    if (busy || !loaded || owner!==getUser()?.id) return;
    const step=event.target.closest('[data-folder-step]');
    if (step) return reorder('folders',step.dataset.folderId,folders.findIndex(f=>f.id===step.dataset.folderId)+Number(step.dataset.folderStep));
    const rename = event.target.closest('[data-folder-rename]'), remove = event.target.closest('[data-folder-delete]');
    const folder = folders.find(f=>f.id === (rename?.dataset.folderRename || remove?.dataset.folderDelete));
    if (!folder) return;
    if (rename) {
      editingId = folder.id; $('noteFolderName').value = folder.name; $('noteFolderNameLabel').textContent = '메모함 이름 변경';
      $('saveNoteFolder').textContent = '이름 저장'; $('cancelNoteFolderEdit').hidden = false; $('noteFolderError').textContent = '';
      $('noteFolderName').focus(); return;
    }
    const count = [...records.values()].filter(r=>r.note.folder_id===folder.id).length;
    if (!confirm(`‘${folder.name}’ 메모함을 삭제할까요?\n현재 불러온 메모 ${count}개를 포함해 이 메모함의 모든 메모가 함께 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    const token = generation, userId = owner;
    setBusy(true); $('noteFolderError').textContent = '';
    try {
      await flush();
      if (!alive(token,userId)) return;
      // The composite FK performs the note deletion atomically on the server.
      checked(await db.from('todo_note_folders').delete().eq('id',folder.id).eq('user_id',userId).select('id').single());
      if (!alive(token,userId)) return;
      for (const [id,r] of records) if (r.note.folder_id===folder.id) {
        r.saver.dispose(); cache(draftKey(id),null); r.element.remove(); records.delete(id);
      }
      folders = folders.filter(f=>f.id!==folder.id);
      if (editingId===folder.id) clearFolderEdit();
      updateView();
    } catch (error) { if (alive(token,userId)) { $('noteFolderError').textContent = `메모함 삭제 실패: ${noteError(error)}`; retry.hidden = false; } }
    finally { if (alive(token,userId)) setBusy(false); }
  };
  function beginMove(id) {
    if (busy || orderMode || !loaded) return;
    const record = records.get(id); if (!record) return;
    closeExpanded(); movingId = id;
    $('noteMoveFrom').textContent = `현재: ${folders.find(f=>f.id===record.note.folder_id)?.name || ''}`;
    const destinations = folders.filter(f=>f.id!==record.note.folder_id);
    $('noteMoveTarget').innerHTML = destinations.map(f=>`<option value="${escape(f.id)}">${escape(f.name)}</option>`).join('');
    $('noteMoveError').textContent = destinations.length ? '' : '다른 메모함이 없습니다. 메모함 관리에서 먼저 만들어 주세요.';
    moveDialog.showModal(); controls();
  }
  $('noteMoveForm').onsubmit = async event => {
    event.preventDefault();
    const record = records.get(movingId), destination = $('noteMoveTarget').value;
    if (busy || !record || !folders.some(f=>f.id===destination) || destination===record.note.folder_id || owner!==getUser()?.id) return;
    const token = generation, userId = owner;
    setBusy(true); $('noteMoveError').textContent = '';
    try {
      // Body/color autosaves never contain folder_id, so a late autosave cannot undo a move.
      const saved=checked(await db.from('todo_notes').update({folder_id:destination,is_hidden:false,updated_at:new Date().toISOString()})
        .eq('id',record.note.id).eq('user_id',userId).select('*').single());
      if (!alive(token,userId)) return;
      record.note.folder_id = destination; record.note.is_hidden = false;
      record.note.sort_order = saved.sort_order;
      moveDialog.close(); updateView();
      message.textContent = `‘${folders.find(f=>f.id===destination).name}’ 메모함으로 이동했습니다.`;
    } catch (error) { if (alive(token,userId)) { $('noteMoveError').textContent = `메모 이동 실패: ${noteError(error)}`; retry.hidden = false; } }
    finally { if (alive(token,userId)) setBusy(false); }
  };

  function reset() {
    folderDrag.cancel(); noteDrag.cancel(); orderMode=false; orderStatus.textContent='';
    closeExpanded(); if (manager.open) manager.close(); if (moveDialog.open) moveDialog.close();
    generation++; records.forEach(r=>r.saver.dispose()); records.clear();
    folders = []; selectedId = ''; editingId = null; movingId = null;
    owner = null; loaded = false; loading = false; busy = false;
    grid.replaceChildren(); updateView(); retry.hidden = true;
  }
  function card(note, prepend = false) {
    const userId = owner, key = draftKey(note.id), token = generation;
    let draft;
    try { draft = JSON.parse(localStorage.getItem(key)); } catch {}
    if (draft && typeof draft.body==='string' && draft.body.length<=20000 && paperColors.some(([c])=>c===draft.color))
      Object.assign(note,{body:draft.body,color:draft.color});
    else draft = null;
    const element = document.createElement('article'); element.className = `sticky-note paper-${note.color}`;
    element.dataset.orderId=note.id;
    element.innerHTML = '<div class="sticky-top"><span class="note-status" role="status"></span><div class="note-tools"><details class="paper-picker"><summary aria-label="포스트잇 종이 색상 변경">색상 ▾</summary><div class="paper-palette"></div></details><button type="button" class="expand-note" aria-label="메모 크게 보기">확대</button><button type="button" class="move-note" aria-label="다른 메모함으로 이동">이동</button><button type="button" class="remove-note" aria-label="메모 삭제">삭제</button></div></div><textarea class="note-body" maxlength="20000" placeholder="여기에 메모하세요…" aria-label="메모 내용"></textarea><p class="note-save-error" role="alert" hidden></p><div class="sticky-bottom"><small class="note-date"></small><button class="note-retry" type="button" hidden>저장 재시도</button></div>';
    const input = element.querySelector('textarea'), status = element.querySelector('.note-status'), retrySave = element.querySelector('.note-retry');
    const bar=document.createElement('div'); bar.className='note-order-bar'; bar.hidden=true;
    bar.innerHTML='<button type="button" class="order-handle" aria-label="메모 순서 끌어서 이동" title="손잡이로 끌어서 이동 · 키보드는 앞/뒤 버튼 사용">⠿</button><span class="note-order-position"></span><button type="button" class="order-step note-order-prev" aria-label="메모를 한 칸 앞으로 이동">앞으로</button><button type="button" class="order-step note-order-next" aria-label="메모를 한 칸 뒤로 이동">뒤로</button>';
    element.prepend(bar);
    bar.querySelector('.note-order-prev').onclick=()=>reorder('notes',note.id,orderedNotes().findIndex(r=>r.note.id===note.id)-1);
    bar.querySelector('.note-order-next').onclick=()=>reorder('notes',note.id,orderedNotes().findIndex(r=>r.note.id===note.id)+1);
    input.value = note.body; status.textContent = '저장됨';
    element.querySelector('.note-date').textContent = new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(note.created_at));
    const saver = createAutoSaver({
      snapshot: () => ({body:input.value,color:note.color}),
      persist: async values => {
        if (!alive(token,userId)) throw new Error('계정이 변경되었습니다.');
        checked(await db.from('todo_notes').update({...values,updated_at:new Date().toISOString()}).eq('id',note.id).eq('user_id',userId).select('id').single());
      },
      status: (state,error) => {
        status.textContent = {pending:'저장 대기',saving:'저장 중…',saved:'저장됨',error:'저장 실패'}[state];
        retrySave.hidden = state!=='error'; status.title = error ? noteError(error) : '';
        const box = element.querySelector('.note-save-error'); box.hidden = state!=='error'; box.textContent = state==='error' ? noteError(error) : '';
      },
      remember: values=>cache(key,values), forget: ()=>cache(key,null)
    });
    records.set(note.id,{saver,element,note});
    element.hidden = note.folder_id!==selectedId;
    element.querySelector('.move-note').onclick = () => beginMove(note.id);
    const expandButton = element.querySelector('.expand-note');
    expandButton.onclick = () => {
      if (busy || orderMode) return;
      if (expandedCard?.element===element) { closeExpanded(); return; }
      closeExpanded(); element.querySelectorAll('details').forEach(d=>d.open=false);
      const placeholder = document.createComment('expanded note'); element.replaceWith(placeholder);
      expandedCard = {element,placeholder,button:expandButton}; expanded.append(element);
      expandButton.textContent = '닫기'; expandButton.setAttribute('aria-label','메모 크게 보기 닫기');
      expanded.showModal(); input.focus({preventScroll:true});
    };
    input.addEventListener('input',saver.changed); input.addEventListener('blur',saver.flush); retrySave.onclick = saver.flush;
    const palette = element.querySelector('.paper-palette');
    for (const [color,label] of paperColors) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = `paper-swatch paper-${color}`; button.setAttribute('aria-pressed',String(note.color===color));
      button.onclick = () => { if (busy || orderMode) return; note.color = color; element.className = `sticky-note paper-${color}`; palette.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); element.querySelector('details').open=false; saver.changed(); };
      palette.append(button);
    }
    element.querySelector('.remove-note').onclick = async () => {
      if (busy || orderMode || !alive(token,userId) || !confirm('이 메모를 영구 삭제할까요?')) return;
      setBusy(true); element.querySelectorAll('details').forEach(d=>d.open=false);
      try {
        await saver.flush(); if (!alive(token,userId)) return;
        checked(await db.from('todo_notes').delete().eq('id',note.id).eq('user_id',userId).select('id').single());
        if (!alive(token,userId)) return;
        if (expandedCard?.element===element) closeExpanded();
        saver.dispose(); cache(key,null); records.delete(note.id); element.remove(); updateView();
      } catch (error) { if (alive(token,userId)) { message.textContent = `메모 삭제 실패: ${noteError(error)}`; retry.hidden=false; } }
      finally { if (alive(token,userId)) setBusy(false); }
    };
    if (prepend) grid.prepend(element); else grid.append(element);
    if (draft) saver.changed();
    return input;
  }
  async function pages(table, userId, order) {
    const rows=[];
    for (let from=0;;from+=500) {
      const page=checked(await db.from(table).select('*').eq('user_id',userId)
        .order('sort_order',{ascending:true}).order('created_at',{ascending:order}).order('id',{ascending:order}).range(from,from+499));
      rows.push(...page); if (page.length<500) return rows;
    }
  }
  async function open() {
    const user = getUser(); if (!user || !db) return;
    if (owner!==user.id) { reset(); owner=user.id; }
    if (loaded || loading) return;
    const token=generation,userId=owner;
    loading=true; controls(); retry.hidden=true; message.textContent='메모함을 불러오는 중…';
    try {
      const [nextFolders,notes]=await Promise.all([pages('todo_note_folders',userId,true),pages('todo_notes',userId,false)]);
      if (!alive(token,userId)) return;
      if (notes.some(n=>!nextFolders.some(f=>f.id===n.folder_id)))
        throw new Error('메모함 목록이 변경되었습니다. 다시 불러오기를 눌러 주세요.');
      folders=nextFolders;
      try { selectedId=localStorage.getItem(storageKey()) || ''; } catch {}
      if (!folders.some(f=>f.id===selectedId)) selectedId=folders.find(f=>f.legacy_key==='general')?.id || folders[0]?.id || '';
      notes.forEach(note=>card(note)); loaded=true; updateView();
    } catch (error) { if (alive(token,userId)) { message.textContent=`메모함을 불러오지 못했습니다. ${noteError(error)}`; retry.hidden=false; } }
    finally { if (alive(token,userId)) { loading=false; controls(); } }
  }
  add.onclick = async () => {
    if (busy || orderMode || !loaded || !selectedId || owner!==getUser()?.id) return;
    const token=generation,userId=owner,folderId=selectedId; setBusy(true);
    try {
      const note=checked(await db.from('todo_notes').insert({user_id:userId,folder_id:folderId,body:'',color:'yellow'}).select('*').single());
      if (!alive(token,userId)) return;
      closeExpanded(); const input=card(note,true); updateView();
      setBusy(false); input.closest('article').scrollIntoView({block:'nearest',behavior:'smooth'}); input.focus({preventScroll:true});
    } catch (error) { if (alive(token,userId)) { message.textContent=`새 메모 생성 실패: ${noteError(error)}`; retry.hidden=false; } }
    finally { if (alive(token,userId)) setBusy(false); }
  };
  retry.onclick = async () => {
    if (busy || loading) return;
    const token=generation,userId=owner;
    setBusy(true); await flush();
    if (!alive(token,userId)) return;
    reset(); await open();
  };
  function flush() { return Promise.all([...records.values()].map(r=>r.saver.flush())); }
  const folderDrag=attachOrderDrag({root:$('noteFolderList'),handleSelector:'.order-handle',itemSelector:'.note-folder-row',enabled:()=>!busy && loaded && manager.open,onMove:(id,index)=>reorder('folders',id,index),scrollContainer:manager});
  const noteDrag=attachOrderDrag({root:grid,handleSelector:'.order-handle',itemSelector:'.sticky-note',enabled:()=>!busy && loaded && orderMode,onMove:(id,index)=>reorder('notes',id,index)});
  manager.addEventListener('close',folderDrag.cancel);
  document.addEventListener('visibilitychange',()=>{if (document.hidden) flush();});
  window.addEventListener('online',flush);
  return {open,reset,flush};
}
