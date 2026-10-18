import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
await fs.access(path.join(dist,'index.html'));
await fs.copyFile(new URL('./pages-worker.mjs',import.meta.url),path.join(dist,'_worker.js'));
await fs.writeFile(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
console.log('Pages bundle prepared. Configure backend secrets on the server.');
