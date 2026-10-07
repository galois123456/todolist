import { taskOnDay } from './calendar-dates.js';
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function dueInPeriod(task,period,today,weekStart='monday'){
 if(task.completed)return false;
 const [y,m,d]=today.split('-').map(Number),start=new Date(y,m-1,d,12),end=new Date(start);
 if(period==='week'){start.setDate(start.getDate()-(start.getDay()-(weekStart==='sunday'?0:1)+7)%7);end.setTime(start.getTime());end.setDate(end.getDate()+6);}
 else if(period==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0);}
 else if(period==='threeDays')end.setDate(end.getDate()+2);
 else if(period!=='today')return false;
 const dueOnly={...task,start_date:null,lunar_start:null};
 for(const day=new Date(start);day<=end;day.setDate(day.getDate()+1))if(taskOnDay(dueOnly,key(day)))return true;
 return false;
}
export function compareCategories(a,b,categories){
 const order=id=>{const n=categories.findIndex(c=>c.id===id);return n<0?categories.length:n;};
 return order(a.category_id)-order(b.category_id)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.title.localeCompare(b.title,'ko');
}
