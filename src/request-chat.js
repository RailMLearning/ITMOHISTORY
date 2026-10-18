function progress(text){window.dispatchEvent(new CustomEvent('history-duel-progress',{detail:text}));}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function requestChat(url,options){
 progress('Мыслители готовят ответы…');
 const first=await fetch(url,{...options,signal:AbortSignal.timeout(125000)});
 const data=await first.json();
 if(!first.ok)return new Response(JSON.stringify(data),{status:first.status,headers:{'Content-Type':'application/json'}});
 if(!data.jobId){progress('');return new Response(JSON.stringify(data),{status:first.status,headers:{'Content-Type':'application/json'}});}
 const deadline=Date.now()+12*60*1000;
 while(Date.now()<deadline){
  progress(data.position>0?`В очереди: ${data.position}. Пожалуйста, подождите…`:'Мыслители готовят ответы…');
  await pause(1800);
  const response=await fetch('/api/jobs/'+encodeURIComponent(data.jobId),{headers:{'X-Job-Token':data.jobToken},cache:'no-store'});
  const status=await response.json();
  if(!response.ok)throw new Error(status.error||'Не удалось проверить готовность ответа');
  if(status.state==='done'){progress('');return new Response(JSON.stringify(status.result),{status:200,headers:{'Content-Type':'application/json'}});}
  if(status.state==='error'){progress('');return new Response(JSON.stringify({error:status.error||'Не удалось сформировать ответ'}),{status:502,headers:{'Content-Type':'application/json'}});}
  data.position=status.position||0;
 }
 progress('');throw new Error('Сервер не успел ответить. Попробуйте позже.');
}
