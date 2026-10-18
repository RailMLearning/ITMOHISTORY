const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function proxy(request,env){
 const values=env;
 const base=values.BACKEND_URL;
 const secret=values.BACKEND_TOKEN;
 if(!base||!secret)return json({error:'Генерация ещё не подключена. Попробуйте позднее.',configured:false},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Метод не поддерживается'},405);
 const pathname=new URL(request.url).pathname;
 const isChat=pathname==='/api/chat'||pathname==='/api/chat/debate';
 const isHealth=pathname==='/api/health';
 const isJob=/^\/api\/jobs\/[a-f0-9-]{36}$/.test(pathname);
 if(request.method==='GET'&&!isHealth&&!isJob)return json({error:'Не найдено'},404);
 if(request.method==='POST'&&!isChat)return json({error:'Не найдено'},404);
 let body;
 if(isChat){
  if(Number(request.headers.get('content-length')||0)>40000)return json({error:'Слишком большой запрос'},413);
  const raw=await request.text();if(raw.length>40000)return json({error:'Слишком большой запрос'},413);
  let payload;try{payload=JSON.parse(raw);}catch{return json({error:'Неверный формат запроса'},400);}
  body=JSON.stringify({route:pathname,payload});
 }
 const suffix=isHealth?'/health':isJob?pathname.slice(4):'/jobs';
 const headers={'Authorization':'Bearer '+secret,'Content-Type':'application/json'};
 const jobToken=request.headers.get('x-job-token');if(jobToken)headers['X-Job-Token']=jobToken;
 const client=request.headers.get('cf-connecting-ip');if(client)headers['X-Client-IP']=client;
 try{
  const upstream=await fetch(base.replace(/\/$/,'')+suffix,{method:request.method,headers,body,signal:AbortSignal.timeout(isChat?120000:15000),redirect:'manual'});
  if(upstream.status>=300&&upstream.status<400)return json({error:'Сервер генерации временно недоступен.'},503);
  const payload=await upstream.text();
  return new Response(payload,{status:upstream.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 }catch{return json({error:'Сервер генерации временно недоступен. Попробуйте позднее.'},503);}
}


export default {fetch(request,env){return new URL(request.url).pathname.startsWith("/api/")?proxy(request,env):env.ASSETS.fetch(request);}};
