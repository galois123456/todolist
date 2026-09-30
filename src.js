import { createClient } from '@supabase/supabase-js';

const $ = id => document.getElementById(id);
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = /^https:\/\/.+\.supabase\.co\/?$/.test(url || '') && key && !key.includes('YOUR_');
const db = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

const state = { user: null, tasks: [], categories: [], view: 'list', month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected: localDate(new Date()), editId: null, authMode: 'login', loading: false };
const priorityName = { high: '높음', medium: '보통', low: '낮음' };
const $views = { list: $('listView'), calendar: $('calendarView'), input: $('inputView'), settings: $('settingsView') };

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseLocal(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
function formatDay(value) { return value ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(parseLocal(value)) : '마감일 없음'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function showNotice(message, error = false) { const n = $('notice'); n.textContent = message; n.classList.toggle('error', error); n.hidden = !message; }
function errorText(error) { return error?.message || '작업에 실패했습니다. 인터넷 연결을 확인하세요.'; }
function checked(result) { if (result.error) throw result.error; return result.data; }
function busy(value) { state.loading = value; $('saveTask').disabled = value; $('authSubmit').disabled = value; }

function applyTheme(value) {
  localStorage.setItem('school-todo-theme', value);
  const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeSelect').value = value;
  $('themeButton').textContent = dark ? '☀ 라이트' : '☾ 다크';
  $('themeButton').title = dark ? '라이트 모드' : '다크 모드';
}
applyTheme(localStorage.getItem('school-todo-theme') || 'system');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(localStorage.getItem('school-todo-theme') || 'system'));
$('themeButton').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('themeSelect').onchange = event => applyTheme(event.target.value);

function showAuth() { $('auth').hidden = false; $('app').hidden = true; $('authMessage').textContent = ''; }
function showApp() { $('auth').hidden = true; $('app').hidden = false; $('accountEmail').textContent = state.user?.email || ''; }
function setAuthMode(mode) {
  state.authMode = mode;
  $('authTitle').textContent = mode === 'signup' ? '새 계정 만들기' : '다시 오셨군요';
  $('authIntro').textContent = mode === 'signup' ? '이메일과 안전한 비밀번호로 가입하세요.' : '이메일과 비밀번호로 로그인하세요.';
  $('authSubmit').textContent = mode === 'signup' ? '회원가입' : '로그인';
  $('authToggle').textContent = mode === 'signup' ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입';
  $('confirmWrap').hidden = mode !== 'signup';
  $('passwordConfirm').required = mode === 'signup';
  $('password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('authMessage').textContent = '';
}
$('authToggle').onclick = () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login');
$('authForm').onsubmit = async event => {
  event.preventDefault(); if (!db || state.loading) return;
  const email = $('email').value.trim(); const password = $('password').value;
  if (state.authMode === 'signup' && password !== $('passwordConfirm').value) { $('authMessage').textContent = '비밀번호 확인이 일치하지 않습니다.'; return; }
  busy(true); $('authMessage').textContent = '';
  try {
    const response = state.authMode === 'signup'
      ? await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
      : await db.auth.signInWithPassword({ email, password });
    checked(response);
    if (state.authMode === 'signup' && !response.data.session) { setAuthMode('login'); $('authMessage').textContent = '가입 확인 메일을 열어 인증한 뒤 로그인하세요.'; }
    else if (response.data.user) await enter(response.data.user);
  } catch (error) { $('authMessage').textContent = errorText(error); }
  finally { busy(false); }
};
$('resetPassword').onclick = async () => {
  const email = $('email').value.trim();
  if (!email) { $('authMessage').textContent = '먼저 이메일을 입력하세요.'; $('email').focus(); return; }
  try { checked(await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin })); $('authMessage').textContent = '비밀번호 변경 메일을 요청했습니다. 메일함을 확인하세요.'; }
  catch (error) { $('authMessage').textContent = errorText(error); }
};
$('signOut').onclick = async () => {
  try { checked(await db.auth.signOut()); state.user = null; state.tasks = []; state.categories = []; showAuth(); setAuthMode('login'); }
  catch (error) { showNotice(errorText(error), true); }
};

async function enter(user) {
  if (state.user?.id === user.id && !$('app').hidden) return;
  state.user = user; showApp(); switchView('list');
  await loadData();
}
async function loadData() {
  if (!state.user) return;
  try {
    let categories = checked(await db.from('todo_categories').select('*').eq('user_id', state.user.id).order('created_at', { ascending: true }));
    if (!categories.length) {
      const values = ['행정', '수업', '학급관리'].map(name => ({ name, user_id: state.user.id }));
      checked(await db.from('todo_categories').upsert(values, { onConflict: 'user_id,name' }));
      categories = checked(await db.from('todo_categories').select('*').eq('user_id', state.user.id).order('created_at', { ascending: true }));
    }
    const tasks = [];
    for (let from = 0; ; from += 500) {
      const page = checked(await db.from('todo_tasks').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).range(from, from + 499));
      tasks.push(...page); if (page.length < 500) break;
    }
    state.categories = categories; state.tasks = tasks; showNotice(''); renderAll();
  } catch (error) { showNotice(`데이터를 불러오지 못했습니다: ${errorText(error)}. SQL 설정을 확인하세요.`, true); }
}
if (!db) {
  $('setupError').hidden = false;
  $('setupError').textContent = 'Supabase 연결 설정이 없습니다. README의 안내대로 .env에 프로젝트 URL과 publishable key를 입력한 후 다시 빌드하세요.';
} else {
  showAuth();
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { state.user = null; state.tasks = []; state.categories = []; showAuth(); }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) setTimeout(() => { enter(session.user); }, 0);
    if (event === 'PASSWORD_RECOVERY') setTimeout(async () => {
      const password = prompt('새 비밀번호를 입력하세요 (6자 이상).');
      if (!password) return;
      if (password.length < 6) { showNotice('비밀번호는 6자 이상이어야 합니다.', true); return; }
      try { checked(await db.auth.updateUser({ password })); showNotice('비밀번호가 변경되었습니다.'); } catch (error) { showNotice(errorText(error), true); }
    }, 0);
  });
  db.auth.getUser().then(({ data, error }) => { if (data?.user) enter(data.user); else if (error) showAuth(); });
}

function switchView(view) {
  if (view === 'input' && state.view !== 'input') prepareTask();
  state.view = view;
  Object.entries($views).forEach(([name, element]) => { element.hidden = name !== view; });
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'calendar') renderCalendar();
  if (view === 'settings') renderCategories();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => switchView(button.dataset.view));

function categoryName(id) { return state.categories.find(c => c.id === id)?.name || '미분류'; }
function isOverdue(task) { return !task.completed && task.due_date && task.due_date < localDate(new Date()); }
function renderAll() {
  $('todayLabel').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  const today = localDate(new Date());
  $('statTotal').textContent = state.tasks.length;
  $('statActive').textContent = state.tasks.filter(t => !t.completed).length;
  $('statToday').textContent = state.tasks.filter(t => !t.completed && t.due_date === today).length;
  $('statOverdue').textContent = state.tasks.filter(isOverdue).length;
  $('statDone').textContent = state.tasks.filter(t => t.completed).length;
  $('focusText').textContent = `${$('statToday').textContent}건이 오늘 마감 · ${$('statOverdue').textContent}건이 기한 초과`;
  renderCategoryOptions(); renderTasks(); renderCalendar(); renderCategories();
}
function renderCategoryOptions() {
  const previous = $('taskCategory').value;
  $('taskCategory').innerHTML = state.categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  if (state.categories.some(c => c.id === previous)) $('taskCategory').value = previous;
  const selected = $('categoryFilter').value;
  $('categoryFilter').innerHTML = '<option value="all">모든 분야</option>' + state.categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  $('categoryFilter').value = state.categories.some(c => c.id === selected) ? selected : 'all';
}
function renderTasks() {
  const keyword = $('search').value.trim().toLocaleLowerCase(); const status = $('statusFilter').value; const cat = $('categoryFilter').value; const today = localDate(new Date());
  const rank = { high: 0, medium: 1, low: 2 };
  const items = state.tasks.filter(t => {
    if (cat !== 'all' && t.category_id !== cat) return false;
    if (keyword && !`${t.title} ${t.note}`.toLocaleLowerCase().includes(keyword)) return false;
    return status === 'all' || (status === 'active' && !t.completed) || (status === 'done' && t.completed) || (status === 'today' && !t.completed && t.due_date === today) || (status === 'overdue' && isOverdue(t));
  }).sort((a, b) => {
    const sort = $('sort').value;
    if (sort === 'priority') return rank[a.priority] - rank[b.priority] || (a.due_date || '9999').localeCompare(b.due_date || '9999');
    if (sort === 'start') return (a.start_date || '9999').localeCompare(b.start_date || '9999');
    if (sort === 'new') return b.created_at.localeCompare(a.created_at);
    if (sort === 'title') return a.title.localeCompare(b.title, 'ko');
    return (a.due_date || '9999').localeCompare(b.due_date || '9999') || rank[a.priority] - rank[b.priority];
  });
  $('shownCount').textContent = `${items.length}건`;
  const taskCard = t => `<article class="task-card ${t.completed ? 'done' : ''} ${isOverdue(t) ? 'overdue' : ''} priority-${t.priority}"><div class="task-body"><button type="button" class="task-name" data-edit="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button><div class="task-meta"><span class="category-name">${escapeHtml(categoryName(t.category_id))}</span><span>중요도 ${priorityName[t.priority]}</span><span>시작 ${t.start_date ? escapeHtml(formatDay(t.start_date)) : '미정'}</span><span>마감 ${t.due_date ? escapeHtml(formatDay(t.due_date)) : '미정'}</span>${isOverdue(t) ? '<span>기한 초과</span>' : ''}</div></div><button type="button" class="complete-btn" data-toggle="${escapeHtml(t.id)}" aria-label="${escapeHtml(t.title)} ${t.completed ? '되돌리기' : '완료'}">${t.completed ? '되돌리기' : '완료'}</button></article>`;
  const active = items.filter(t => !t.completed), done = items.filter(t => t.completed);
  $('taskList').innerHTML = (active.length ? active.map(taskCard).join('') : '<div class="empty">진행 중인 업무가 없습니다.</div>') + (done.length ? `<div class="completed-section"><h3>완료한 업무</h3>${done.map(taskCard).join('')}</div>` : '');
}
['search', 'statusFilter', 'categoryFilter', 'sort'].forEach(id => $(id).addEventListener('input', renderTasks));
$('taskList').addEventListener('click', e => { const button = e.target.closest('[data-edit]'); if (button) openTask(button.dataset.edit); });
$('taskList').addEventListener('click', async e => { const button = e.target.closest('[data-toggle]'); if (button) await toggleTask(button.dataset.toggle, button); });
async function toggleTask(id, button) {
  const task = state.tasks.find(t => t.id === id); if (!task) return;
  const completed = !task.completed; button.disabled = true;
  try { checked(await db.from('todo_tasks').update({ completed, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', state.user.id).select().single()); task.completed = completed; renderAll(); }
  catch (error) { button.disabled = false; showNotice(errorText(error), true); }
}

function renderCalendar() {
  const year = state.month.getFullYear(), month = state.month.getMonth();
  $('monthTitle').textContent = `${year}년 ${month + 1}월`;
  const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7;
  const days = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  const today = localDate(new Date());
  $('calendarGrid').innerHTML = Array.from({ length: days }, (_, i) => {
    const date = new Date(year, month, i + 1 - offset); const key = localDate(date);
    const matches = state.tasks.filter(t => t.due_date === key).sort((a, b) => Number(a.completed) - Number(b.completed));
    return `<button type="button" class="day ${date.getMonth() !== month ? 'other' : ''} ${key === today ? 'today' : ''} ${key === state.selected ? 'selected' : ''}" data-date="${key}" aria-label="${key}, 마감 ${matches.length}건"><span class="day-number">${date.getDate()}</span><span class="day-items">${matches.slice(0, 2).map(t => `<span class="calendar-task ${t.priority} ${t.completed ? 'done' : ''}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>`).join('')}${matches.length > 2 ? `<span class="more-count">+${matches.length - 2}건</span>` : ''}</span></button>`;
  }).join('');
  const matches = state.tasks.filter(t => t.due_date === state.selected).sort((a, b) => Number(a.completed) - Number(b.completed));
  $('agendaDate').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(parseLocal(state.selected));
  $('agendaList').innerHTML = matches.length ? matches.map(t => `<div class="agenda-item"><button type="button" data-edit="${escapeHtml(t.id)}">${t.completed ? '✓ ' : ''}${escapeHtml(t.title)}</button><small>${escapeHtml(categoryName(t.category_id))} · 중요도 ${priorityName[t.priority]}${t.completed ? ' · 완료' : ''}</small></div>`).join('') : '<p class="muted">이 날짜에 마감되는 업무가 없습니다.</p>';
}
$('calendarGrid').onclick = e => { const cell = e.target.closest('[data-date]'); if (!cell) return; state.selected = cell.dataset.date; state.month = new Date(parseLocal(state.selected).getFullYear(), parseLocal(state.selected).getMonth(), 1); renderCalendar(); };
$('agendaList').onclick = e => { const target = e.target.closest('[data-edit]'); if (target) openTask(target.dataset.edit); };
$('prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); };
$('nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); };
$('currentMonth').onclick = () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); state.selected = localDate(new Date()); renderCalendar(); };
$('addOnDate').onclick = () => openTask(null, state.selected);

function prepareTask(id = null, dueDate = '') {
  const t = state.tasks.find(item => item.id === id); state.editId = t?.id || null;
  $('taskForm').reset(); $('dialogTitle').textContent = t ? '업무 수정' : '새 업무 입력'; $('deleteTask').hidden = !t; $('taskError').textContent = '';
  $('taskTitle').value = t?.title || ''; $('taskNote').value = t?.note || ''; $('taskCategory').value = t?.category_id || state.categories[0]?.id || '';
  $('taskPriority').value = t?.priority || 'medium'; $('taskStart').value = t?.start_date || ''; $('taskDue').value = t?.due_date || dueDate;
}
function openTask(id = null, dueDate = '') { switchView('input'); prepareTask(id, dueDate); $('taskTitle').focus(); }
$('closeDialog').onclick = $('cancelDialog').onclick = () => switchView('list');
$('taskForm').onsubmit = async event => {
  event.preventDefault(); if (state.loading) return;
  if ($('taskStart').value && $('taskDue').value && $('taskStart').value > $('taskDue').value) { $('taskError').textContent = '마감일은 시작일보다 빠를 수 없습니다.'; return; }
  const values = { user_id: state.user.id, title: $('taskTitle').value.trim(), note: $('taskNote').value.trim(), category_id: $('taskCategory').value, priority: $('taskPriority').value, start_date: $('taskStart').value || null, due_date: $('taskDue').value || null, updated_at: new Date().toISOString() };
  if (!values.title || !values.category_id) { $('taskError').textContent = '제목과 업무 분야를 확인하세요.'; return; }
  busy(true);
  try {
    if (state.editId) checked(await db.from('todo_tasks').update(values).eq('id', state.editId).eq('user_id', state.user.id).select().single());
    else checked(await db.from('todo_tasks').insert(values).select().single());
    await loadData(); switchView('list'); showNotice('업무를 저장했습니다.');
  } catch (error) { $('taskError').textContent = errorText(error); }
  finally { busy(false); }
};
$('deleteTask').onclick = async () => {
  const t = state.tasks.find(item => item.id === state.editId); if (!t || !confirm(`“${t.title}” 업무를 삭제할까요?`)) return;
  busy(true); try { checked(await db.from('todo_tasks').delete().eq('id', t.id).eq('user_id', state.user.id).select().single()); await loadData(); switchView('list'); showNotice('업무를 삭제했습니다.'); }
  catch (error) { $('taskError').textContent = errorText(error); } finally { busy(false); }
};

function renderCategories() {
  $('categoryList').innerHTML = state.categories.map(c => `<div class="category-row"><strong>${escapeHtml(c.name)}</strong><div><button type="button" data-rename="${escapeHtml(c.id)}">이름 변경</button><button type="button" data-remove="${escapeHtml(c.id)}">삭제</button></div></div>`).join('');
}
$('categoryForm').onsubmit = async e => {
  e.preventDefault(); const name = $('categoryName').value.trim(); if (!name) return;
  try { checked(await db.from('todo_categories').insert({ name, user_id: state.user.id })); $('categoryName').value = ''; await loadData(); }
  catch (error) { showNotice(errorText(error), true); }
};
$('categoryList').onclick = async e => {
  const rename = e.target.closest('[data-rename]'); const remove = e.target.closest('[data-remove]');
  if (rename) {
    const category = state.categories.find(c => c.id === rename.dataset.rename); const name = prompt('새 업무 분야 이름', category.name)?.trim(); if (!name || name === category.name) return;
    try { checked(await db.from('todo_categories').update({ name }).eq('id', category.id).eq('user_id', state.user.id).select().single()); await loadData(); }
    catch (error) { showNotice(errorText(error), true); }
  } else if (remove) {
    const category = state.categories.find(c => c.id === remove.dataset.remove);
    if (state.categories.length < 2) { showNotice('업무 분야는 최소 1개가 필요합니다.', true); return; }
    if (state.tasks.some(t => t.category_id === category.id)) { showNotice('이 분야를 사용하는 업무가 있어 삭제할 수 없습니다.', true); return; }
    if (!confirm(`“${category.name}” 분야를 삭제할까요?`)) return;
    try { checked(await db.from('todo_categories').delete().eq('id', category.id).eq('user_id', state.user.id).select().single()); await loadData(); }
    catch (error) { showNotice(errorText(error), true); }
  }
};

function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function csvDate(value) {
  const v = String(value || '').trim(); if (!v) return null;
  const match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) { const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; if (localDate(parseLocal(date)) === date) return date; }
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) { const date = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`; if (localDate(parseLocal(date)) === date) return date; }
  throw new Error(`인식할 수 없는 날짜: ${v}`);
}
function csvTime(value) {
  if (!value) return undefined;
  const num = Number(value); const date = Number.isFinite(num) && num > 1000000000 ? new Date(num < 100000000000 ? num * 1000 : num) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function download(name, content, type) {
  const a = document.createElement('a'); const link = URL.createObjectURL(new Blob([content], { type })); a.href = link; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(link), 30000);
}
$('exportJson').onclick = () => {
  const data = { format: 'school-todo-v1', exportedAt: new Date().toISOString(), categories: state.categories.map(c => c.name), tasks: state.tasks.map(t => ({ id: t.legacy_id || t.id, title: t.title, note: t.note, category: categoryName(t.category_id), priority: t.priority, startDate: t.start_date, dueDate: t.due_date, completed: t.completed, createdAt: t.created_at, updatedAt: t.updated_at })) };
  download(`학교업무_백업_${localDate(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
};
async function ensureCategories(names) {
  const unique = [...new Set(names.map(s => String(s || '').trim()).filter(Boolean))];
  if (unique.some(s => s.length > 40)) throw new Error('업무 분야 이름은 40자 이하여야 합니다.');
  const existing = new Set(state.categories.map(c => c.name)); const fresh = unique.filter(name => !existing.has(name));
  if (fresh.length) { checked(await db.from('todo_categories').upsert(fresh.map(name => ({ name, user_id: state.user.id })), { onConflict: 'user_id,name' })); await loadData(); }
}
function normalizeImported(raw, index) {
  const title = String(raw.title || '').trim(); if (!title || title.length > 200) throw new Error(`${index}행: 제목이 비었거나 너무 깁니다.`);
  const category = String(raw.category || '행정').trim() || '행정';
  const priority = ['high','medium','low'].includes(raw.priority) ? raw.priority : 'medium';
  const start = csvDate(raw.startDate), due = csvDate(raw.dueDate);
  if (start && due && start > due) throw new Error(`${index}행: 마감일이 시작일보다 빠릅니다.`);
  const note = String(raw.note || ''); if (note.length > 10000) throw new Error(`${index}행: 메모가 너무 깁니다.`);
  const complete = raw.completed === true || ['true', 'TRUE', '1', '완료'].includes(String(raw.completed).trim());
  const legacy = String(raw.id || `row-${index}-${title}-${due || ''}`).trim();
  return { title, note, category, priority, start, due, completed: complete, legacy_id: legacy, created_at: csvTime(raw.createdAt), updated_at: csvTime(raw.updatedAt) };
}
async function importTasks(rows) {
  const normalized = rows.map((raw, i) => normalizeImported(raw, i + 2));
  await ensureCategories(normalized.map(t => t.category));
  const ids = new Set(state.tasks.map(t => t.id)); const legacyIds = new Set(state.tasks.map(t => t.legacy_id).filter(Boolean));
  const seen = new Set(); const incoming = normalized.filter(t => {
    if (ids.has(t.legacy_id) || legacyIds.has(t.legacy_id) || seen.has(t.legacy_id)) return false;
    seen.add(t.legacy_id); return true;
  });
  const catByName = new Map(state.categories.map(c => [c.name, c.id])); let saved = 0;
  for (let i = 0; i < incoming.length; i += 100) {
    const batch = incoming.slice(i, i + 100).map(t => ({ user_id: state.user.id, category_id: catByName.get(t.category), title: t.title, note: t.note, priority: t.priority, start_date: t.start, due_date: t.due, completed: t.completed, legacy_id: t.legacy_id, ...(t.created_at ? { created_at: t.created_at } : {}), ...(t.updated_at ? { updated_at: t.updated_at } : {}) }));
    checked(await db.from('todo_tasks').upsert(batch, { onConflict: 'user_id,legacy_id' })); saved += batch.length;
    $('importStatus').textContent = `${saved}건 가져옴…`;
  }
  await loadData(); $('importStatus').textContent = `${saved}건 가져옴 · 기존 ${normalized.length - incoming.length}건 건너뜀`;
}
async function handleFile(input, handler) {
  const file = input.files?.[0]; if (!file) return;
  $('importStatus').textContent = '파일을 읽는 중입니다.'; input.disabled = true;
  try { await handler(await file.text()); }
  catch (error) { $('importStatus').textContent = `가져오기 실패: ${errorText(error)} (일부는 저장되었을 수 있습니다. 다시 가져오면 중복은 건너뜁니다.)`; await loadData(); }
  finally { input.disabled = false; input.value = ''; }
}
$('csvInput').onchange = e => handleFile(e.target, async text => {
  const [headers, ...rows] = parseCsv(text); if (!headers) throw new Error('CSV가 비어 있습니다.');
  const required = ['ID', '업무 제목', '세부 내용', '업무 분야', '중요도', '업무 시작일', '완료 여부', '마감일', '등록 시각', '수정 시각'];
  const order = required.map(h => headers.findIndex(v => v.trim() === h)); if (order.some(n => n < 0)) throw new Error('기존 ‘업무’ 시트의 CSV가 아닙니다. 첫 행의 열 이름을 확인하세요.');
  await importTasks(rows.map(row => { const values = order.map(i => row[i] || ''); return { id: values[0], title: values[1], note: values[2], category: values[3], priority: values[4], startDate: values[5], completed: values[6], dueDate: values[7], createdAt: values[8], updatedAt: values[9] }; }));
});
$('categoryCsvInput').onchange = e => handleFile(e.target, async text => {
  const rows = parseCsv(text); const names = rows.flatMap((row, i) => i === 0 && ['업무 분야','업무분야','분야'].includes(row[0]?.trim()) ? [] : [row[0]]);
  await ensureCategories(names); $('importStatus').textContent = `업무 분야 ${names.filter(Boolean).length}건 확인했습니다.`;
});
$('jsonInput').onchange = e => handleFile(e.target, async text => {
  const data = JSON.parse(text); if (data.format !== 'school-todo-v1' || !Array.isArray(data.tasks) || !Array.isArray(data.categories)) throw new Error('이 앱에서 내보낸 JSON 백업이 아닙니다.');
  await ensureCategories(data.categories); await importTasks(data.tasks);
});
