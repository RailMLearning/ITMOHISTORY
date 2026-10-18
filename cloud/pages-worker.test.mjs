import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './pages-worker.mjs';
test('unconfigured proxy fails without contacting an upstream',async()=>{
 const response=await worker.fetch(new Request('https://unit.test/api/health'),{});
 assert.equal(response.status,503);assert.equal((await response.json()).configured,false);
});
test('credential is sent only to upstream and never returned to the browser',async(t)=>{
 const secret='unit-test-only-placeholder';let forwarded;
 t.mock.method(globalThis,'fetch',async(url,options)=>{forwarded={url,options};return Response.json({reply:'test answer'});});
 const response=await worker.fetch(new Request('https://unit.test/api/chat',{method:'POST',body:JSON.stringify({message:'question',character:'west'})}),{BACKEND_URL:'https://backend.example.test',BACKEND_TOKEN:secret});
 assert.equal(forwarded.url,'https://backend.example.test/jobs');assert.equal(forwarded.options.headers.Authorization,'Bearer '+secret);assert.equal(forwarded.options.redirect,'manual');
 const body=await response.text();assert.equal(response.status,200);assert.ok(!body.includes(secret));assert.ok(!JSON.stringify([...response.headers]).includes(secret));
});
test('redirects cannot forward server credentials to another host',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{Location:'https://other.example.test'}}));
 const response=await worker.fetch(new Request('https://unit.test/api/health'),{BACKEND_URL:'https://backend.example.test',BACKEND_TOKEN:'placeholder'});
 assert.equal(response.status,503);assert.equal(response.headers.get('Location'),null);
});
test('invalid route and method are rejected before forwarding',async()=>{
 const env={BACKEND_URL:'https://backend.example.test',BACKEND_TOKEN:'placeholder'};
 assert.equal((await worker.fetch(new Request('https://unit.test/api/unknown'),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://unit.test/api/chat',{method:'DELETE'}),env)).status,405);
});
