export const timetableColors = [
 ['yellow','노랑','#facc15','#854d0e'],['orange','주황','#fb923c','#9a3412'],['pink','분홍','#f9a8d4','#be185d'],['red','빨강','#fca5a5','#b91c1c'],
 ['blue','파랑','#93c5fd','#1d4ed8'],['sky','하늘','#7dd3fc','#0369a1'],['teal','청록','#5eead4','#0f766e'],['green','초록','#86efac','#15803d'],
 ['lime','연두','#bef264','#4d7c0f'],['purple','보라','#c4b5fd','#7e22ce'],['indigo','남색','#a5b4fc','#4338ca'],['rose','장미','#fb7185','#9f1239'],
 ['brown','갈색','#d6a77a','#78350f'],['cream','크림','#fde68a','#92400e'],['gray','회색','#cbd5e1','#475569'],['white','흰색','#ffffff','#64748b']
];
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

export function findRoomProfile(rows, room) {
  const key = String(room || '').trim(); if (!key) return null;
  let found = null;
  for (const row of rows) for (let day=0;day<7;day++) {
    const cell=row.cells?.[day]; if (cell?.room?.trim()===key) found={subject:cell.subject || '',color:cell.color || 'white'};
  }
  return found;
}
