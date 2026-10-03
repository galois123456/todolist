export const timetableColors = [['yellow','노랑','#fef3c7'],['orange','주황','#ffedd5'],['pink','분홍','#fce7f3'],['blue','파랑','#dbeafe'],['green','초록','#dcfce7'],['purple','보라','#ede9fe'],['gray','회색','#f3f4f6'],['white','흰색','#ffffff']];
export function localDay(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function weekDays(anchor, weekStart) {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  date.setDate(date.getDate() - (date.getDay() - (weekStart === 'sunday' ? 0 : 1) + 7) % 7);
  return Array.from({length:7},(_,i) => { const day = new Date(date); day.setDate(day.getDate()+i); return { date:localDay(day), weekday:day.getDay(), label:`${day.getMonth()+1}/${day.getDate()}` }; });
}
export function detailKey(rowId, date) { return `${rowId}:${date}`; }
export function normalizeTemplate(value) {
  if (!Array.isArray(value?.rows)) return {rows:[]};
  return {rows:value.rows.slice(0,100).map(row => ({ id:String(row.id), label:String(row.label || '').slice(0,40), start:String(row.start || '').slice(0,5), end:String(row.end || '').slice(0,5), cells:Object.fromEntries(Array.from({length:7},(_,day) => { const cell=row.cells?.[day] || {}; return [day,{room:String(cell.room || '').slice(0,80),subject:String(cell.subject || '').slice(0,80),color:timetableColors.some(([key])=>key===cell.color)?cell.color:'white'}]; })) }))};
}
