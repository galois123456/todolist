export function normalizeLink(link){
  let url=String(link?.url||'').trim();if(!url)throw new Error('인터넷 주소를 입력하거나 빈 링크를 삭제하세요.');
  if(!/^[a-z][a-z\d+.-]*:/i.test(url))url='https://'+url;
  let parsed;try{parsed=new URL(url);}catch{throw new Error('인터넷 주소를 확인하세요.');}
  if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw new Error('http 또는 https 인터넷 주소만 입력할 수 있습니다.');
  if(url.length>2048)throw new Error('인터넷 주소가 너무 깁니다.');
  return {name:String(link.name||'').trim().slice(0,100),url:parsed.href};
}
export function validateAttachments(raw){
  const value=raw??{links:[],photos:[]};
  if(!Array.isArray(value.links)||!Array.isArray(value.photos)||value.links.length>50||value.photos.length>20)throw new Error('첨부 자료 형식이나 개수를 확인하세요.');
  const links=value.links.map(normalizeLink);
  const photos=value.photos.map(photo=>{if(typeof photo.data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo.data)||photo.data.length>550000)throw new Error('저장할 사진 형식을 확인하세요.');return {name:String(photo.name||'사진').slice(0,200),data:photo.data};});
  const result={links,photos};if(JSON.stringify(result).length>8*1024*1024)throw new Error('한 일정의 사진 용량이 너무 큽니다. 사진 수를 줄여주세요.');return result;
}
