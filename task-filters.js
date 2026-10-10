import { taskOnDay } from './calendar-dates.js';
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function dueInPeriod(task,period,today,weekStart='monday'){
 if(task.completed)return false;
 const [y,m,d]=today.split('-').map(Number),start=new Date(y,m-1,d,12),end=new Date(start);
 if(period==='week'){start.setDate(start.getDate()-(start.getDay()-(weekStart==='sunday'?0:1)+7)%7);end.setTime(start.getTime());end.setDate(end.getDate()+6);}
 else if(period==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0);}
 else if(['threeDays','fiveDays','sevenDays'].includes(period))end.setDate(end.getDate()+({threeDays:2,fiveDays:4,sevenDays:6}[period]));
 else if(period!=='today')return false;
 const dueOnly={...task,start_date:null,lunar_start:null};
 for(const day=new Date(start);day<=end;day.setDate(day.getDate()+1))if(taskOnDay(dueOnly,key(day)))return true;
 return false;
}
export function compareCategories(a,b,categories){
 const order=id=>{const n=categories.findIndex(c=>c.id===id);return n<0?categories.length:n;};
 return order(a.category_id)-order(b.category_id)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.title.localeCompare(b.title,'ko');
}

// Every schedule view keeps completed items last, then uses the selected list order.
export function compareTasks(a,b,sort='due',categories=[]){
 const completed=Number(!!a.completed)-Number(!!b.completed);
 if(completed)return completed;
 const rank={high:0,medium:1,low:2};
 const due=()=>(a.due_date||'9999').localeCompare(b.due_date||'9999');
 if(sort==='priority')return rank[a.priority]-rank[b.priority]||due();
 if(sort==='start')return (a.start_date||'9999').localeCompare(b.start_date||'9999');
 if(sort==='new')return (b.created_at||'').localeCompare(a.created_at||'');
 if(sort==='title')return a.title.localeCompare(b.title,'ko');
 if(sort==='category')return compareCategories(a,b,categories);
 return due()||rank[a.priority]-rank[b.priority];
}
