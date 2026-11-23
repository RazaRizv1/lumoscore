// GET /lxapi/testwallet?net=stellar|xrpl|near&a=<address> -> { ok, test: true|false, price? }
// PUBLIC: the Launch and listing pages ask whether the CONNECTED wallet is an approved test wallet, to show
// the minimum price (see _lib/testwallets.js). One address in, one yes/no out -- the list is never sent. A
// "yes" changes only what the page shows; the listing endpoints check the paying address again themselves.
import { isTestWallet, TEST_PRICE, NETS } from '../../_lib/testwallets.js';

function json(body) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json',
    'cache-control': 'private, no-store', 'access-control-allow-origin': '*' } });
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const net = String(u.searchParams.get('net') || '');
  if (!NETS[net]) return json({ ok: false, error: 'unknown network' });
  const test = await isTestWallet(env, net, u.searchParams.get('a'));
  return json(test ? { ok: true, test: true, price: TEST_PRICE } : { ok: true, test: false });
}
