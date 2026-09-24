#!/usr/bin/env node
// Call a tool straight from the terminal, without wiring up an MCP client.
//
//   node try.js                      list the tools
//   node try.js get_market asset=SHX-GDSTRSHX…
//   node try.js get_quote from=XLM to=SHX-GDSTRSHX… amount=100
//
// This is a convenience for checking the server by hand. It calls the SAME tool functions the MCP
// server calls, so a result here is the result an agent gets -- it is not a second implementation
// that could agree with the first while both are wrong.
import { TOOLS } from './tools.js';

const [, , name, ...rest] = process.argv;

if (!name || name === '--help' || name === '-h') {
  console.log('\nLumosCore MCP — ' + TOOLS.length + ' tools\n');
  for (const t of TOOLS) {
    const args = Object.keys(t.schema).map((k) => ((t.required || []).includes(k) ? k : `[${k}]`)).join(' ');
    console.log('  ' + t.name.padEnd(17) + (args || '(no arguments)'));
    console.log('  ' + ' '.repeat(17) + t.title);
  }
  console.log('\n  node try.js get_quote from=XLM to=SHX-GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH amount=100\n');
  process.exit(0);
}

const tool = TOOLS.find((t) => t.name === name);
if (!tool) {
  console.error(`Unknown tool "${name}". Run without arguments to list them.`);
  process.exit(1);
}

const args = {};
for (const pair of rest) {
  const i = pair.indexOf('=');
  if (i < 0) { console.error(`Arguments are key=value. Got: ${pair}`); process.exit(1); }
  const k = pair.slice(0, i), v = pair.slice(i + 1);
  args[k] = (tool.schema[k] && tool.schema[k].type === 'number') ? Number(v) : v;
}

const missing = (tool.required || []).filter((k) => args[k] === undefined || args[k] === '');
if (missing.length) { console.error(`Missing: ${missing.join(', ')}`); process.exit(1); }

try {
  const r = await tool.run(args);
  const text = r && r.content && r.content[0] ? r.content[0].text : '(no output)';
  if (r && r.isError) { console.error('\n' + text + '\n'); process.exit(1); }
  console.log('\n' + text + '\n');
} catch (e) {
  console.error('\n' + ((e && e.message) || e) + '\n');
  process.exit(1);
}
