const STOP = new Set('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это каким почему должна должно должны следовать ответьте кратко двух предложениях пожалуйста'.split(' '));
export function terms(text){return [...new Set((String(text).toLowerCase().replaceAll('ё','е').match(/[а-яa-z0-9]+/gu)||[]).filter(t=>t.length>2&&!STOP.has(t)).map(t=>t.length>5?t.slice(0,5):t))];}
export function ftsQuery(text){return terms(text).slice(0,12).map(t=>'"'+t+'"').join(' OR ');}
export function mergeRanks(semantic,lexical){
 const scores=new Map();
 for(const [list,weight] of [[semantic,.75],[lexical,.25]])list.forEach((item,i)=>{const id=item.id; const old=scores.get(id)||{id,score:0};old.score+=weight/(60+i+1);scores.set(id,old);});
 return [...scores.values()].sort((a,b)=>b.score-a.score).slice(0,4);
}
export function historyOf(value){return (Array.isArray(value)?value:[]).filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-8).map(x=>({role:x.role,content:x.content.trim().slice(0,1800)})).filter(x=>x.content);}
export function sourceOf(row){
 const raw=typeof row.metadata==='string'?JSON.parse(row.metadata):row.metadata;
 const tidy=value=>typeof value==='string'?value.replace(/\s*интернет-портал «Азбука веры»\s*/gi,' ').replace(/\s+/g,' ').trim():value;
 const meta=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,tidy(v)]));
 const files={chaadaev_tom_1:'Chaadaev_P_Polnoe_sobranie_sochineniy_i_izbrannye_pisma_Tom_1.pdf',chaadaev_tom_2:'Chaadaev_P_Polnoe_sobranie_sochineniy_i_izbrannye_pisma_Tom_2.pdf',khomyakov_tom_1:'хомяков том 1.pdf',khomyakov_tom_2:'хомяков том 2.pdf',khomyakov_tom_3:'хомяков том 3.pdf',khomyakov_tom_8:'хомяков том 8.pdf'};
 const file=files[meta.sourceId||meta.id];
 return {...meta,quoteSnippet:tidy(row.text).slice(0,330),url:file?'https://github.com/RailMLearning/ITMOHISTORY/blob/main/backend/sources/'+encodeURIComponent(file):null};
}
export async function retrieve(env,character,message,embedding){
 const query=ftsQuery(message);
 const [vectors,lexical]=await Promise.all([
  env.INDEX.query(embedding,{topK:12,namespace:character,returnMetadata:'none'}),
  query?env.DB.prepare('SELECT id FROM chunk_terms WHERE chunk_terms MATCH ? AND character=? ORDER BY rank LIMIT 12').bind(query,character).all():{results:[]},
 ]);
 const ordered=mergeRanks(vectors.matches||[],lexical.results||[]);
 if(!ordered.length)return [];
 const result=await env.DB.prepare('SELECT * FROM chunks WHERE character=? AND id IN ('+ordered.map(()=>'?').join(',')+')').bind(character,...ordered.map(x=>x.id)).all();
 const map=new Map(result.results.map(row=>[row.id,row]));
 return ordered.map(x=>map.get(x.id)).filter(Boolean).slice(0,2);
}
export function cleanReply(value){
 const raw=String(value||'');
 // Never expose an unfinished reasoning block if generation stops early.
 if(raw.includes('<think>')&&!raw.includes('</think>'))return '';
 return raw.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^\s*<\/think>\s*/,'').trim();
}
