import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {createAutoSaver} from '../note-autosave.js';import {appColors} from '../app-colors.js';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.nodes={};this.events={};this.attrs={};this.style={};this.open=false;}
 append(node){node.remove();node.parent=this;this.children.push(node);} prepend(node){node.remove();node.parent=this;this.children.unshift(node);}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
 replaceWith(node){const p=this.parent;if(!p)return;const i=p.children.indexOf(this);node.remove();p.children[i]=node;node.parent=p;this.parent=null;}
 replaceChildren(){for(const n of [...this.children])n.remove();}
 querySelector(s){return this.nodes[s]??=new Element(s);}
 querySelectorAll(s){if(s==='button')return this.children;return [];}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
 focus(){}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}
}
test('16색 자동 저장과 확대 편집 후 원위치 복귀, 서식 저장 제외',async()=>{
 const grid=new Element(),body=new Element(),nodes={notesGrid:grid,notesMessage:new Element(),newNote:new Element(),retryNotes:new Element(),toggleHiddenNotes:new Element(),notesTitle:new Element()};
 const writes=[];let row={id:'note',body:'기존 내용',color:'yellow',created_at:'2026-10-01T00:00:00Z'};
 const db={from:()=>{let values=null;const chain={select:()=>chain,eq:()=>chain,order:()=>chain,update:v=>{values=v;return chain;},single:async()=>{writes.push(values);row={...row,...values};return {data:{id:'note'}};},then:resolve=>resolve({data:[{...row}]})};return chain;}};
 const storage=new Map();const ctx={createAutoSaver,appColors,db,document:{body,getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createComment:()=>new Element('comment'),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout,clearTimeout};
 vm.createContext(ctx);const source=readFileSync(new URL('../notes.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');vm.runInContext(source+'\nvar controller=createNotes({db,getUser:()=>({id:"owner"})});',ctx);
 await ctx.controller.open();const card=grid.children[0];const palette=card.querySelector('.paper-palette');
 for(let i=0;i<appColors.length;i++){palette.children[i].onclick();await ctx.controller.flush();assert.equal(writes.at(-1).color,appColors[i][0]);}
 const expand=card.querySelector('.expand-note');expand.onclick();const dialog=body.children[0];assert.equal(dialog.open,true);assert.equal(dialog.children[0],card);
 const input=card.querySelector('textarea');input.value='확대 화면에서 수정';input.events.input();await ctx.controller.flush();expand.onclick();assert.equal(dialog.open,false);assert.equal(grid.children[0],card);assert.equal(input.value,'확대 화면에서 수정');
 assert.equal('text_style' in writes.at(-1),false);
 const hide=card.querySelector('.hide-note');await hide.onclick();assert.equal(row.is_hidden,true);assert.equal(card.hidden,true);
 nodes.toggleHiddenNotes.onclick();assert.equal(card.hidden,false);assert.equal(hide.textContent,'보이기');
 expand.onclick();await hide.onclick();assert.equal(dialog.open,false);assert.equal(row.is_hidden,false);assert.equal(card.hidden,true);
 nodes.toggleHiddenNotes.onclick();assert.equal(card.hidden,false);
 await hide.onclick();
 ctx.controller.reset();await ctx.controller.open();assert.equal(grid.children[0].hidden,true);nodes.toggleHiddenNotes.onclick();assert.equal(grid.children[0].hidden,false);const restored=grid.children[0].querySelector('textarea');assert.equal(restored.value,'확대 화면에서 수정');ctx.controller.reset();
});
