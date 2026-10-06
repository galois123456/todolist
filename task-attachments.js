import './task-attachments.css';
import { validateAttachments, normalizeLink } from './task-attachments-model.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createTaskAttachments({db,getUser}) {
  const $=id=>document.getElementById(id);
  let value={links:[],photos:[]}, ready=true, processing=false, generation=0, kind='links', editing=false, draft;
  const dialog=$('attachmentsDialog');
  function status(text){$('attachmentsStatus').textContent=text;}
  function render(){
    $('taskLinks').textContent=value.links.length?`링크 (${value.links.length})`:'링크';
    $('taskPhotos').textContent=value.photos.length?`사진 보기 (${value.photos.length})`:'사진';
    for(const id of ['taskLinks','taskPhotos'])$(id).disabled=!ready||processing;
  }
  function reset(){generation++;value={links:[],photos:[]};ready=true;processing=false;dialog.close();status('');render();}
  async function load(id){
    reset();if(!id)return;
    const token=generation,owner=getUser()?.id;ready=false;render();status('링크와 사진을 불러오는 중…');
    try{
      const result=await db.from('todo_tasks').select('attachments').eq('id',id).eq('user_id',owner).single();
      if(result.error)throw result.error;
      if(token!==generation||owner!==getUser()?.id)return;
      value=validateAttachments(result.data.attachments);ready=true;status('');
    }catch(error){if(token===generation){status(`첨부 자료를 불러오지 못했습니다. 일정을 다시 열어주세요. ${error.message}${['42703','PGRST204'].includes(error.code)?' · migrate-ver1.24.sql 실행이 필요합니다.':''}`);}}
    finally{if(token===generation)render();}
  }
  function open(type,edit){kind=type;editing=edit;draft=structuredClone(value);draw();dialog.showModal();}
  function draw(){
    $('attachmentsTitle').textContent=(kind==='links'?'링크':'사진')+(editing?' 편집':' 보기');
    $('attachmentAddLink').hidden=kind!=='links'||!editing;
    $('attachmentAddPhoto').hidden=kind!=='photos'||!editing;
    $('attachmentApply').hidden=!editing;
    $('attachmentEdit').hidden=editing;
    $('attachmentError').textContent='';
    $('attachmentsBody').scrollTop=0;
    $('attachmentsBody').innerHTML=kind==='links'?draft.links.map((link,i)=>editing?
      `<div class="attachment-link-edit"><label>이름 (선택)<input data-link-name="${i}" maxlength="100" value="${esc(link.name)}" placeholder="예: 행사 안내"></label><label>인터넷 주소<input data-link-url="${i}" type="url" value="${esc(link.url)}" placeholder="https://example.com"></label><button type="button" class="text-button" data-remove-link="${i}">삭제</button></div>`:
      `<a class="button secondary attachment-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.name||link.url)} ↗</a>`).join(''):
      draft.photos.map((photo,i)=>`<figure class="attachment-photo"><img src="${esc(photo.data)}" alt="${esc(photo.name)}"><figcaption><span title="${esc(photo.name)}">${esc(photo.name)}</span>${editing?`<button type="button" class="text-button" data-remove-photo="${i}">삭제</button>`:''}</figcaption></figure>`).join('');
    if(!draft[kind].length)$('attachmentsBody').textContent=kind==='links'?'등록한 링크가 없습니다.':'등록한 사진이 없습니다.';
  }
  function capture(){if(kind==='links'&&editing){for(const el of $('attachmentsBody').querySelectorAll('[data-link-name]'))draft.links[Number(el.dataset.linkName)].name=el.value;for(const el of $('attachmentsBody').querySelectorAll('[data-link-url]'))draft.links[Number(el.dataset.linkUrl)].url=el.value;}}
  $('taskLinks').onclick=()=>open('links',!value.links.length);
  $('taskPhotos').onclick=()=>open('photos',!value.photos.length);
  $('attachmentEdit').onclick=()=>{editing=true;draw();};
  $('attachmentClose').onclick=()=>{if(!processing)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(processing)e.preventDefault();});
  $('attachmentAddLink').onclick=()=>{capture();if(draft.links.length>=50){$('attachmentError').textContent='링크는 일정당 50개까지 등록할 수 있습니다.';return;}draft.links.push({name:'',url:''});draw();$('attachmentsBody').lastElementChild?.querySelector('input')?.focus();};
  $('attachmentsBody').onclick=e=>{const link=e.target.closest('[data-remove-link]'),photo=e.target.closest('[data-remove-photo]');if(processing)return;if(link){capture();draft.links.splice(Number(link.dataset.removeLink),1);draw();}if(photo){draft.photos.splice(Number(photo.dataset.removePhoto),1);draw();}};
  $('attachmentAddPhoto').onclick=()=>$('attachmentFiles').click();
  $('attachmentFiles').onchange=async e=>{
    const files=[...e.target.files];e.target.value='';if(!files.length)return;
    if(draft.photos.length+files.length>20){$('attachmentError').textContent='사진은 일정당 20장까지 등록할 수 있습니다.';return;}
    const token=generation;processing=true;render();$('attachmentAddPhoto').disabled=true;$('attachmentApply').disabled=true;status('사진을 준비하는 중…');
    try{const photos=[];for(const file of files)photos.push(await compressPhoto(file));if(token!==generation)return;const next={...draft,photos:[...draft.photos,...photos]};validateAttachments(next);draft=next;draw();}
    catch(error){if(token===generation)$('attachmentError').textContent=error.message;}
    finally{if(token===generation){processing=false;status('');render();}$('attachmentAddPhoto').disabled=false;$('attachmentApply').disabled=false;}
  };
  $('attachmentApply').onclick=()=>{try{capture();draft.links=draft.links.map(normalizeLink);value=validateAttachments(draft);render();dialog.close();status('변경한 링크와 사진은 일정 저장을 누르면 저장됩니다.');}catch(error){$('attachmentError').textContent=error.message;}};
  return {load,reset,read(){if(!ready)throw new Error('링크와 사진을 불러오지 못했거나 불러오는 중입니다. 잠시 후 다시 시도하거나 일정을 다시 열어주세요.');if(processing)throw new Error('사진 준비가 끝난 뒤 저장하세요.');return validateAttachments(value);}};
}
export async function compressPhoto(file){
  const heic=/\.hei[cf]$/i.test(file.name)||/image\/hei[cf]/i.test(file.type);
  if(!file.type.startsWith('image/')&&!heic)throw new Error('사진 파일을 선택하세요.');
  if(file.size>30*1024*1024)throw new Error('사진 한 장의 원본 크기는 30MB 이하여야 합니다.');
  let url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;
    try{await img.decode();}catch(error){
      if(!heic)throw error;
      const {heicTo}=await import('heic-to');
      let converted;try{converted=await heicTo({blob:file,type:'image/jpeg',quality:.9});}catch{throw new Error('이 HEIC 사진을 변환하지 못했습니다. 사진 앱에서 JPEG로 내보내 다시 선택하세요.');}
      URL.revokeObjectURL(url);url=URL.createObjectURL(converted);img.src=url;await img.decode();
    }
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let data;for(const quality of [.85,.7,.55,.4]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<=550000)break;}
    if(data.length>550000)throw new Error('사진이 너무 복잡해 용량을 줄이지 못했습니다. 크기를 줄인 사진을 선택하세요.');
    return {name:file.name.slice(0,200),data};
  }catch(error){if(error.name==='EncodingError')throw new Error('이 사진 형식을 읽을 수 없습니다. JPG 또는 PNG로 변환해서 선택하세요.');throw error;}
  finally{URL.revokeObjectURL(url);}
}
