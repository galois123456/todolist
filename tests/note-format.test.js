import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {normalizeNoteFormat,applyNoteFormat,noteSaveError} from '../note-format.js';import {appColors} from '../app-colors.js';
test('기존 메모 기본 서식, 허용 범위 검사, 안전한 스타일 적용',()=>{
 assert.deepEqual(normalizeNoteFormat(),{fontSize:16,bold:false,underline:false,textColor:'#27272a'});
 assert.equal(normalizeNoteFormat({fontSize:999,textColor:'url(https://x)'}).textColor,'#27272a');
 const input={style:{}};applyNoteFormat(input,{fontSize:28,bold:true,underline:true,textColor:'#123abc'});
 assert.deepEqual(input.style,{fontSize:'28px',fontWeight:'700',textDecoration:'underline',color:'#123abc'});
 applyNoteFormat(input,{});assert.equal(input.style.textDecoration,'none');
});
test('메모 색상 16종과 저장 컬럼을 기존 자료 삭제 없이 마이그레이션',()=>{
 const sql=readFileSync(new URL('../supabase/migrate-ver1.35.sql',import.meta.url),'utf8');
 for(const [color] of appColors)assert.ok(sql.includes("'"+color+"'"));
 assert.match(sql,/add column if not exists text_style/);assert.doesNotMatch(sql,/drop table|delete from|truncate/i);
 assert.match(noteSaveError({code:'23514'}),/migrate-ver1.35.sql/);
});
