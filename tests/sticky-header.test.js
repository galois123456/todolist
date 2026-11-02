import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installStickyHeader} from '../sticky-header.js';

test('상단 높이 변경·로그인 표시·회전 시 스크롤 여유 공간을 갱신',()=>{
  const original=globalThis.ResizeObserver;
  let callback,observed,disconnected=false,height=0;
  globalThis.ResizeObserver=class {
    constructor(fn){callback=fn;}
    observe(el){observed=el;}
    disconnect(){disconnected=true;}
  };
  const values={},header={getBoundingClientRect:()=>({height})};
  try{
    const dispose=installStickyHeader(header,{style:{setProperty:(k,v)=>values[k]=v}});
    assert.equal(observed,header);assert.equal(values['--app-header-height'],'0px');
    height=126.4;callback();assert.equal(values['--app-header-height'],'127px');
    height=87;callback();assert.equal(values['--app-header-height'],'87px');
    dispose();assert.equal(disconnected,true);
  }finally{globalThis.ResizeObserver=original;}
});

test('제목은 키보드로 누를 수 있는 캘린더 버튼이며 기존 이동 보호를 사용',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<h1><button id="appHome"[^>]*data-view="calendar"[^>]*>나만의 To Do List<\/button><\/h1>/);
  const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('function switchView(view)'),source.indexOf('\nfunction categoryName'));
  let flushed=0,rendered=0,scrolled=0,allowed=true;
  const button={dataset:{view:'calendar'},classList:{toggle(){}}};
  const ctx={state:{view:'notes'},colorPickers:{closeAll(){}},timetable:{canLeave:()=>allowed},notes:{flush(){flushed++;}},
    syncViews(){},desktopLayout:{matches:false},renderCalendar(){rendered++;},
    window:{scrollTo(){scrolled++;}},document:{querySelectorAll:()=>[button]}};
  vm.createContext(ctx);vm.runInContext(body,ctx);button.onclick();
  assert.equal(ctx.state.view,'calendar');assert.equal(flushed,1);assert.equal(rendered,1);assert.equal(scrolled,1);
  ctx.state.view='timetable';allowed=false;button.onclick();
  assert.equal(ctx.state.view,'timetable');assert.equal(scrolled,1);
  allowed=true;button.onclick();assert.equal(ctx.state.view,'calendar');assert.equal(scrolled,2);
});
