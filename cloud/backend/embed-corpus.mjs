import fs from 'node:fs/promises';
import {api} from './cloud-api.mjs';
const chunks=JSON.parse(await fs.readFile('data/chunks.json','utf8'));
const model='@cf/baai/bge-m3';
await fs.mkdir('data/embeddings',{recursive:true});
const batchSize=16;
let next=0,complete=0;
async function run(){while(next<chunks.length){
 const start=next;next+=batchSize;
 const batch=chunks.slice(start,start+batchSize),file='data/embeddings/'+String(start).padStart(5,'0')+'.json';
 try{const existing=JSON.parse(await fs.readFile(file,'utf8'));if(existing.length===batch.length&&existing.every((v,i)=>v.id===batch[i].fragmentId&&v.values.length===1024)){complete+=batch.length;continue;}}catch{}
 let embeddings;
 for(let attempt=0;attempt<3;attempt++){
  try{embeddings=await api('/ai/run/'+model,{text:batch.map(c=>c.text)});break;}catch(error){if(attempt===2||error.status===401||error.status===403||error.status===402)throw error;await new Promise(r=>setTimeout(r,1500*(attempt+1)));}
 }
 if(!Array.isArray(embeddings.data)||embeddings.data.length!==batch.length||embeddings.data.some(v=>v.length!==1024))throw new Error('Unexpected embedding response shape; no checkpoint written');
 const vectors=batch.map((c,i)=>({id:c.fragmentId,namespace:c.character,values:embeddings.data[i]}));
 await fs.writeFile(file,JSON.stringify(vectors));complete+=batch.length;
 if(complete%160===0||complete===chunks.length)console.log('Embedded '+complete+'/'+chunks.length);
}}
await Promise.all([run(),run(),run()]);
const vectors=[];
for(let start=0;start<chunks.length;start+=batchSize)vectors.push(...JSON.parse(await fs.readFile('data/embeddings/'+String(start).padStart(5,'0')+'.json','utf8')));
await fs.writeFile('data/vectors.ndjson',vectors.map(v=>JSON.stringify(v)).join('\n')+'\n');
console.log('Saved '+vectors.length+' vectors, model '+model);
