import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {createAutoSaver} from '../note-autosave.js';import {normalizeNoteFormat,applyNoteFormat,noteFontSizes,noteSaveError} from '../note-format.js';import {appColors} from '../app-colors.js';
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
test('16색·서식 자동 저장/복원과 확대 편집 후 원위치 복귀',async()=>{
 const grid=new Element(),body=new Element(),nodes={notesGrid:grid,notesMessage:new Element(),newNote:new Element(),retryNotes:new Element()};
 const writes=[];let row={id:'note',body:'기존 내용',color:'yellow',created_at:'2026-10-01T00:00:00Z'};
 const db={from:()=>{let values=null;const chain={select:()=>chain,eq:()=>chain,order:()=>chain,update:v=>{values=v;return chain;},single:async()=>{writes.push(values);row={...row,...values};return {data:{id:'note'}};},then:resolve=>resolve({data:[{...row}]})};return chain;}};
 const storage=new Map();const ctx={createAutoSaver,normalizeNoteFormat,applyNoteFormat,noteFontSizes,noteSaveError,appColors,db,document:{body,getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createComment:()=>new Element('comment'),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout,clearTimeout};
 vm.createContext(ctx);const source=readFileSync(new URL('../notes.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');vm.runInContext(source+'\nvar controller=createNotes({db,getUser:()=>({id:"owner"})});',ctx);
 await ctx.controller.open();const card=grid.children[0];const palette=card.querySelector('.paper-palette');
 for(let i=0;i<appColors.length;i++){palette.children[i].onclick();await ctx.controller.flush();assert.equal(writes.at(-1).color,appColors[i][0]);}
 const size=card.querySelector('.note-font-size');size.value='24';size.onchange();card.querySelector('.note-bold').onclick();card.querySelector('.note-underline').onclick();const ink=card.querySelector('.note-text-color');ink.value='#123456';ink.oninput();
 const expand=card.querySelector('.expand-note');expand.onclick();const dialog=body.children[0];assert.equal(dialog.open,true);assert.equal(dialog.children[0],card);
 const input=card.querySelector('textarea');input.value='확대 화면에서 수정';input.events.input();await ctx.controller.flush();expand.onclick();assert.equal(dialog.open,false);assert.equal(grid.children[0],card);assert.equal(input.value,'확대 화면에서 수정');
 assert.equal(writes.at(-1).text_style.fontSize,24);assert.equal(writes.at(-1).text_style.bold,true);assert.equal(writes.at(-1).text_style.underline,true);assert.equal(writes.at(-1).text_style.textColor,'#123456');
 ctx.controller.reset();await ctx.controller.open();const restored=grid.children[0].querySelector('textarea');assert.equal(restored.style.fontSize,'24px');assert.equal(restored.value,'확대 화면에서 수정');ctx.controller.reset();
});
