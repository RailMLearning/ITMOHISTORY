// Import tooling uses environment variables, never desktop OAuth configuration.
export async function api(endpoint,body){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID;
 const token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN locally.');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+endpoint,{
  method:body===undefined?'GET':'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(120000),
 });
 const data=await response.json();
 // Do not reflect provider diagnostics, request bodies or credentials in logs.
 if(!response.ok||data.success===false){const error=new Error('Cloudflare API request failed (HTTP '+response.status+').');error.status=response.status;throw error;}
 return data.result;
}
