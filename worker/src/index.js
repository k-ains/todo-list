export default {
async fetch(request) {
const url = new URL(request.url);
const upstream = 'https://todo-list.dcism.org' + url.pathname + url.search;


if (request.method === 'OPTIONS') {
return new Response(null, { headers: corsHeaders(request) });
}


const init = { method: request.method, headers: new Headers(request.headers) };
init.headers.delete('host');
init.headers.delete('origin');


if (request.method !== 'GET' && request.method !== 'HEAD') {
const ct = request.headers.get('content-type') || '';
const bodyText = await request.text(); // <-- forward as text
init.body = bodyText;
if (ct) init.headers.set('content-type', ct); // keep original
}


const resp = await fetch(upstream, init);
const out = new Headers(resp.headers);
const cors = corsHeaders(request);
for (const [k,v] of Object.entries(cors)) out.set(k,v);
return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: out });
}
};


function corsHeaders(req){
return {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') || 'Content-Type',
'Access-Control-Max-Age': '86400'
};
}