import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
const cache=new Map();
export function parseHolidays(xml) {
 const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(xml); const response=parsed.response;
 if(!response||!['00','0'].includes(String(response.header?.resultCode))) throw new Error('공휴일 제공기관에서 조회를 거부했습니다. 인증키·활용승인을 확인하세요.');
 const raw=response.body?.items?.item; const rows=raw?(Array.isArray(raw)?raw:[raw]):[];
 return rows.filter(r=>r.isHoliday==='Y').map(r=>({date:String(r.locdate).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),name:String(r.dateName)}));
}
export default async function handler(req,res) {
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 const year=String(req.query.year||'');if(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>2100)return res.status(400).json({error:'공휴일 조회 범위는 1900~2100년입니다.'});
 const key=process.env.DATA_GO_KR_SERVICE_KEY;
 if(!key)return res.status(503).json({error:'Vercel에 DATA_GO_KR_SERVICE_KEY를 설정하면 공휴일이 표시됩니다.'});
 try{
  const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const {data,error}=await db.auth.getUser(token);
  if(error||!data?.user)return res.status(401).json({error:'공휴일 조회에는 로그인이 필요합니다.'});
  const hit=cache.get(year);if(hit&&Date.now()-hit.at<21600000)return res.status(200).json({holidays:hit.rows});
  let serviceKey=key.trim();try{serviceKey=decodeURIComponent(serviceKey);}catch{}
  const url=new URL('https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo');url.search=new URLSearchParams({ServiceKey:serviceKey,solYear:year,numOfRows:'100',pageNo:'1'}).toString();
  const upstream=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!upstream.ok)throw new Error('공휴일 서비스 연결에 실패했습니다.');
  const rows=parseHolidays(await upstream.text());if(rows.length===0)throw new Error('이 연도의 공휴일 정보가 아직 제공되지 않았습니다.');
  cache.set(year,{at:Date.now(),rows});res.setHeader('Cache-Control','private, max-age=3600');return res.status(200).json({holidays:rows});
 }catch(error){return res.status(502).json({error:error.name==='TimeoutError'?'공휴일 조회 시간이 초과되었습니다. 다시 시도하세요.':(error.message?.startsWith('공휴일')||error.message?.startsWith('이 연도')?error.message:'공휴일 조회에 실패했습니다. 서버 환경변수를 확인하세요.')});}
}
