import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {terms} from './src/rag.mjs';
const source=process.argv[2] || fileURLToPath(new URL('../../backend/data/chunks.jsonl',import.meta.url));
const chunks=(await fs.readFile(source,'utf8')).trim().split(/\r?\n/).map(x=>JSON.parse(x)).map(c=>({...c,text:c.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ')}));
const sqlText=value=>"'"+String(value).replaceAll("'","''")+"'";
let sql=await fs.readFile('schema.sql','utf8');
sql+='\nDELETE FROM chunk_terms;\n';
for(const chunk of chunks){
 const {text,tags,...meta}=chunk;
 const metadata={...meta,id:chunk.sourceId};
 sql+='INSERT OR REPLACE INTO chunks(id,character,text,metadata) VALUES('+[chunk.fragmentId,chunk.character,text,JSON.stringify(metadata)].map(sqlText).join(',')+');\n';
 sql+='INSERT INTO chunk_terms(id,character,terms) VALUES('+[chunk.fragmentId,chunk.character,terms(text).join(' ')].map(sqlText).join(',')+');\n';
}
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/corpus.sql',sql);
await fs.writeFile('data/chunks.json',JSON.stringify(chunks));
console.log(JSON.stringify({chunks:chunks.length,characters:chunks.reduce((a,c)=>(a[c.character]=(a[c.character]||0)+1,a),{}),sqlBytes:Buffer.byteLength(sql),textChars:chunks.reduce((n,c)=>n+c.text.length,0)}));
