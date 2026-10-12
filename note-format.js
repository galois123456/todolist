export const noteFontSizes=[14,16,18,20,24,28,32];
export function normalizeNoteFormat(raw){
 const value=raw&&typeof raw==='object'?raw:{};
 return {fontSize:noteFontSizes.includes(value.fontSize)?value.fontSize:16,bold:value.bold===true,underline:value.underline===true,textColor:/^#[0-9a-f]{6}$/i.test(value.textColor||'')?value.textColor:'#27272a'};
}
export function applyNoteFormat(input,format){
 const f=normalizeNoteFormat(format);
 input.style.fontSize=f.fontSize+'px';input.style.fontWeight=f.bold?'700':'400';input.style.textDecoration=f.underline?'underline':'none';input.style.color=f.textColor;
}
export function noteSaveError(error){
 if(['23514','42703','PGRST204'].includes(error?.code))return '메모 저장 설정을 업데이트해야 합니다. Supabase에서 migrate-ver1.35.sql을 실행한 뒤 저장 재시도를 누르세요.';
 return error?.message||'인터넷 연결을 확인한 뒤 저장을 다시 시도하세요.';
}
