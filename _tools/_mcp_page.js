// #15 Build the net-new "MCP" product page (clones the app shell from lumoscore-wallet.html,
// swaps <main> for MCP content, adds key lumoscore-mcp.html) and wires the dead data-id="mcp" nav link.
// Idempotent: rebuilds the mcp key each run; nav wiring is an exact swap.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

const CFG={
  hedera:{name:'Hedera',nat:'HBAR'}, aptos:{name:'Aptos',nat:'APT'}, starknet:{name:'Starknet',nat:'STRK'},
  vechain:{name:'VeChain',nat:'VET'}, worldchain:{name:'World Chain',nat:'WLD'},
  stellar:{name:'Stellar',nat:'XLM'}, xrpl:{name:'XRP Ledger',nat:'XRP'},
};
const I={
  plug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
  quote:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  drop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
  bridge:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 1.5 12 4 15"/><path d="M20 9l2.5 3L20 15"/><path d="M2.5 12h19"/></svg>',
  rocket:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.9 12.9 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/></svg>',
  layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  gift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 7l2-3h12l2 3"/><circle cx="17" cy="13" r="1.4"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M14 9l3 3"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>',
  term:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 8 8 11 5 14"/><line x1="11" y1="14" x2="15" y2="14"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  minus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  pie:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
};

const STYLE=`<style id="lx-mcp">
.mcp-wrap{max-width:1340px;margin:0 auto;padding:6px 14px 60px}
.mcp-crumb{font-size:13px;color:var(--text-soft);margin:0 0 20px}
.mcp-crumb a{color:var(--text-muted);text-decoration:none}
.mcp-hero{position:relative;display:grid;grid-template-columns:1.02fr .98fr;gap:38px;align-items:center;margin-bottom:60px}
.mcp-hero::before{content:'';position:absolute;top:-90px;right:-60px;width:560px;height:460px;background:radial-gradient(45% 45% at 60% 40%,var(--accent-soft),transparent 70%);opacity:.85;filter:blur(10px);z-index:0;pointer-events:none}
.mcp-hero-l,.mcp-hero-r{position:relative;z-index:1}
.mcp-badge{display:inline-flex;align-items:center;gap:8px;font:700 12px/1 'JetBrains Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);padding:7px 13px;border-radius:999px}
.mcp-badge b{color:var(--text);font-weight:700}
.mcp-badge svg{width:14px;height:14px;flex-shrink:0}
.mcp-hero h1{font-size:48px;line-height:1.05;font-weight:800;letter-spacing:-.03em;color:var(--text);margin:18px 0 0}
.mcp-hero h1 em{font-style:normal;background:linear-gradient(120deg,var(--accent),var(--accent-2,#ff894c));-webkit-background-clip:text;background-clip:text;color:transparent}
.mcp-hero p{font-size:17px;line-height:1.6;color:var(--text-muted);margin:16px 0 0;max-width:48ch}
.mcp-install{display:flex;align-items:center;gap:14px;background:#0c1018;border:1px solid #242c3d;border-radius:13px;padding:13px 14px 13px 18px;margin-top:24px;max-width:440px;box-shadow:0 18px 40px -26px rgba(0,0,0,.7)}
.mcp-install code{font:600 14.5px/1 'JetBrains Mono',monospace;color:#e9edf5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mcp-install code .p{color:var(--accent);margin-right:9px;font-weight:700}
.mcp-install .cp{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font:700 11.5px/1 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--accent-2,#ff894c);background:rgba(255,138,76,.1);border:1px solid rgba(255,138,76,.24);padding:7px 11px;border-radius:8px;transition:background .15s}
.mcp-install .cp:hover{background:rgba(255,138,76,.2)}
.mcp-install .cp svg{width:13px;height:13px}
.mcp-cta-row{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}
.mcp-btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:14.5px;text-decoration:none;color:#fff;background:linear-gradient(180deg,var(--accent-2,#ff894c),var(--accent));padding:12px 20px;border-radius:12px;box-shadow:0 12px 26px -12px var(--accent-soft);transition:transform .15s}
.mcp-btn:hover{transform:translateY(-2px)}
.mcp-btn.ghost{color:var(--text);background:var(--surface-2);border:1px solid var(--border);box-shadow:none}
.mcp-stats{display:flex;align-items:baseline;margin-top:30px;flex-wrap:wrap;gap:8px 0}
.mcp-stats>div{display:flex;align-items:baseline;gap:7px;padding:0 20px;border-left:1px solid var(--border)}
.mcp-stats>div:first-child{padding-left:0;border-left:none}
.mcp-stats b{font:800 18px/1 'JetBrains Mono',monospace;color:var(--text);letter-spacing:-.01em}
.mcp-stats span{font-size:13px;color:var(--text-soft)}
/* always-dark terminal (real CLI look, both themes) */
.mcp-term{background:#0b0f18;border:1px solid #212838;border-radius:16px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.7)}
.mcp-term-bar{display:flex;align-items:center;gap:7px;padding:12px 14px;border-bottom:1px solid #1c2333;background:#121826}
.mcp-term-bar i{width:11px;height:11px;border-radius:50%;background:#2a3346}
.mcp-term-bar i:first-child{background:#ff5f57}.mcp-term-bar i:nth-child(2){background:#febc2e}.mcp-term-bar i:nth-child(3){background:#28c840}
.mcp-term-bar span{margin-left:8px;font:600 12px/1 'JetBrains Mono',monospace;color:#7d879e}
.mcp-term-body{padding:18px 20px 20px;font:500 13px/1.75 'JetBrains Mono',monospace;color:#c7d0e2}
.mcp-term-body p{margin:0 0 10px}
.mcp-term-body .u{color:#fff;padding-left:16px;position:relative}
.mcp-term-body .u::before{content:'›';position:absolute;left:0;color:var(--accent-2,#ff894c);font-weight:700}
.mcp-term-body .cmd{color:#e9edf5}.mcp-term-body .cmd .p{color:var(--accent-2,#ff894c);font-weight:700;margin-right:9px}
.mcp-term-body .a{color:#98a2ba}.mcp-term-body .a b{color:var(--accent-2,#ff894c);font-weight:600}
.mcp-term-body .c{color:#5f6b85}
.mcp-term-body .dim{color:#69748e}
.mcp-term-body .ok{color:#43d38a}
.mcp-term-body .ok.last{margin-bottom:0}
.mcp-sec{margin:0 0 54px}
.mcp-sec-head{max-width:640px;margin:0 0 26px}
.mcp-sec-head h2{font-size:30px;font-weight:800;letter-spacing:-.025em;color:var(--text);margin:0}
.mcp-sec-head p{font-size:15.5px;line-height:1.6;color:var(--text-muted);margin:10px 0 0}
.mcp-ic{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);margin-bottom:14px;flex-shrink:0}
.mcp-ic svg{width:22px;height:22px}
/* features — big accent cards with 3D illustrations (always-dark, matches ref) */
.mcp-feat{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.fcard{position:relative;overflow:hidden;border-radius:20px;background:#0a0a10;border:1px solid var(--fbd);padding:32px 30px 34px}
.fcard::before{content:"";position:absolute;top:-42%;left:-15%;right:-15%;height:76%;background:radial-gradient(ellipse at 32% 100%,var(--fgl),transparent 64%);pointer-events:none;z-index:0}
.fcard>*{position:relative;z-index:1}
.fcard .fic{width:56px;height:56px;border-radius:50%;border:1.5px solid var(--fbd2);display:grid;place-items:center;color:var(--facc);margin-bottom:22px}
.fcard .fic svg{width:26px;height:26px}
.fcard h3{font-size:23px;font-weight:800;letter-spacing:-.02em;color:#fff;margin:0}
.fcard .ul{width:34px;height:3px;border-radius:2px;background:var(--facc);margin:14px 0 16px}
.fcard p{font-size:15px;line-height:1.62;color:#a7a7b0;margin:0}
.fc-ember{--facc:#ff9a3d;--fbd:rgba(234,106,44,.5);--fbd2:rgba(234,106,44,.42);--fgl:rgba(234,106,44,.2)}
.fc-iris{--facc:#a89bff;--fbd:rgba(124,108,245,.5);--fbd2:rgba(124,108,245,.42);--fgl:rgba(124,108,245,.2)}
.fc-teal{--facc:#2dd4bf;--fbd:rgba(45,212,191,.45);--fbd2:rgba(45,212,191,.42);--fgl:rgba(45,212,191,.17)}
/* commands — header with 3D server art + individual command cards */
.mcp-cmdhead{max-width:680px;margin:0 0 28px}
.mcp-cmdhead .k{color:#a89bff;font:800 13px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase}
.mcp-cmdhead h2{font-size:40px;font-weight:800;letter-spacing:-.03em;color:var(--text);margin:13px 0 12px;line-height:1.02}
.mcp-cmdhead h2 .g{background:linear-gradient(100deg,#a89bff,#ff9a3d);-webkit-background-clip:text;background-clip:text;color:transparent}
.mcp-cmdhead p{font-size:15.5px;line-height:1.6;color:var(--text-muted);margin:0;max-width:52ch}
.mcp-cmds{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cmd2{display:flex;align-items:center;gap:16px;background:#0a0a10;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px 18px;transition:border-color .18s,background .18s}
.cmd2:hover{border-color:rgba(255,255,255,.16);background:#0d0d14}
.cmd2 .cic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex-shrink:0}
.cmd2 .cic svg{width:22px;height:22px}
.cmd2.read .cic{background:rgba(124,108,245,.13);color:#a89bff}
.cmd2.write .cic{background:rgba(234,106,44,.14);color:#ff9a3d}
.cmd2 .cbody{flex:1;min-width:0}
.cmd2 code{font:700 15px/1 'JetBrains Mono',monospace;color:#fff}
.cmd2 .cd{font-size:12.5px;line-height:1.4;color:#8a8a96;margin-top:4px}
.cmd2 .ctag{flex-shrink:0;font:700 10px/1 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 11px;border-radius:8px;overflow:hidden}
.cmd2.read .ctag{color:#a89bff;background:rgba(124,108,245,.14) !important}
.cmd2.write .ctag{color:#ff9a3d;background:rgba(234,106,44,.15) !important}
.cmd2.read .ctag::after{content:"read"}
.cmd2.write .ctag::after{content:"write"}
/* ===== light theme (hero + cards adapt; terminals stay dark) ===== */
[data-theme="light"] .lxh{background:#f2f1ee;border-color:rgba(0,0,0,.07)}
[data-theme="light"] .lxh-grid{background-image:linear-gradient(rgba(0,0,0,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.045) 1px,transparent 1px)}
[data-theme="light"] .lxh-glow.g1{background:rgba(234,106,44,.15)}
[data-theme="light"] .lxh-glow.g2{background:rgba(255,154,61,.1)}
[data-theme="light"] .lxh-glow.g3{background:rgba(255,196,80,.06)}
[data-theme="light"] .lxh h1{color:#17171c}
[data-theme="light"] .lxh h1 .grad{background:linear-gradient(100deg,#ea6a2c,#ff9a3d);-webkit-background-clip:text;background-clip:text;color:transparent}
[data-theme="light"] .lxh-sub{color:#5f5f6a}
[data-theme="light"] .lxh-badge{background:rgba(234,106,44,.09);border-color:rgba(234,106,44,.24)}
[data-theme="light"] .lxh-badge span{color:#cf5f1c}
[data-theme="light"] .lxh-badge i{background:#ea6a2c}
[data-theme="light"] .lxh-install{background:#fff;border-color:rgba(0,0,0,.1)}
[data-theme="light"] .lxh-install code{color:#17171c}
[data-theme="light"] .lxh-install .p{color:#9a9aa2}
[data-theme="light"] .lxh-install:hover{border-color:rgba(234,106,44,.42);background:#fff8f3}
[data-theme="light"] .lxh-btn.s{background:rgba(0,0,0,.045);color:#17171c;border-color:rgba(0,0,0,.13)}
[data-theme="light"] .lxh-btn.s:hover{background:rgba(0,0,0,.08);border-color:rgba(0,0,0,.24)}
[data-theme="light"] .lxh-stats{border-top-color:rgba(0,0,0,.1)}
[data-theme="light"] .lxh-stats .v{color:#17171c}
[data-theme="light"] .lxh-stats .l{color:#8a8a92}
[data-theme="light"] .lxh-stats .dv{background:rgba(0,0,0,.11)}
[data-theme="light"] .fcard{background:#fff;border-color:var(--fbd)}
[data-theme="light"] .fcard h3{color:#17171c}
[data-theme="light"] .fcard p{color:#5f5f6a}
[data-theme="light"] .fc-ember{--facc:#ea6a2c}
[data-theme="light"] .fc-iris{--facc:#6f5ded}
[data-theme="light"] .fc-teal{--facc:#0d9488}
[data-theme="light"] .mcp-cmdhead .k{color:#6f5ded}
[data-theme="light"] .cmd2{background:#fff;border-color:rgba(0,0,0,.08)}
[data-theme="light"] .cmd2:hover{background:#faf9fc;border-color:rgba(0,0,0,.16)}
[data-theme="light"] .cmd2 code{color:#17171c}
[data-theme="light"] .cmd2 .cd{color:#6a6a74}
[data-theme="light"] .cmd2.read .cic{background:rgba(111,93,237,.1);color:#6f5ded}
[data-theme="light"] .cmd2.write .cic{background:rgba(234,106,44,.1);color:#ea6a2c}
[data-theme="light"] .cmd2.read .ctag{color:#6f5ded;background:rgba(111,93,237,.1) !important}
[data-theme="light"] .cmd2.write .ctag{color:#ea6a2c;background:rgba(234,106,44,.1) !important}
/* light terminals (hero + quickstart + JSON) */
[data-theme="light"] .lxh-term{background:#fff;border-color:rgba(0,0,0,.1);box-shadow:0 0 0 1px rgba(234,106,44,.12),0 22px 50px -26px rgba(0,0,0,.28)}
[data-theme="light"] .lxh-term.win{box-shadow:0 0 0 1px rgba(22,163,74,.3),0 0 48px rgba(22,163,74,.14),0 22px 50px -26px rgba(0,0,0,.28)}
[data-theme="light"] .lxh-tbar{background:#f3f3f6;border-bottom-color:rgba(0,0,0,.07)}
[data-theme="light"] .lxh-tbar .nm{color:#8a8a94}
[data-theme="light"] .lxh-tbody{color:#3f3f4a}
[data-theme="light"] .lxh-tbody .lxh-dim{color:#a2a2ab}
[data-theme="light"] .lxh-tbody .lxh-sec{color:#5a5a64}
[data-theme="light"] .lxh-tbody .lxh-ok{color:#16a34a}
[data-theme="light"] .lxh-tbody .lxh-warn{color:#b7791f}
[data-theme="light"] .lxh-tbody .lxh-w{color:#141419}
[data-theme="light"] .lxh-tbody .lxh-p{color:#ea6a2c}
[data-theme="light"] .lxh-pgt{background:rgba(0,0,0,.08)}
[data-theme="light"] .lxh-scan{background:linear-gradient(90deg,transparent,rgba(234,106,44,.3),transparent)}
[data-theme="light"] .lxh-cursor .c{background:rgba(234,106,44,.75)}
[data-theme="light"] .mcp-term{background:#fff;border-color:rgba(0,0,0,.1);box-shadow:0 22px 50px -30px rgba(0,0,0,.25)}
[data-theme="light"] .mcp-term-bar{background:#f3f3f6;border-bottom-color:rgba(0,0,0,.08)}
[data-theme="light"] .mcp-term-bar span{color:#8a8a94}
[data-theme="light"] .mcp-term-body{color:#3f3f4a}
[data-theme="light"] .mcp-term-body .u{color:#141419}
[data-theme="light"] .mcp-term-body .u::before{color:#ea6a2c}
[data-theme="light"] .mcp-term-body .cmd{color:#141419}
[data-theme="light"] .mcp-term-body .cmd .p{color:#ea6a2c}
[data-theme="light"] .mcp-term-body .a{color:#5a5a64}
[data-theme="light"] .mcp-term-body .a b{color:#ea6a2c}
[data-theme="light"] .mcp-term-body .c{color:#a2a2ab}
[data-theme="light"] .mcp-term-body .dim{color:#a8a8b0}
[data-theme="light"] .mcp-term-body .ok{color:#16a34a}
[data-theme="light"] .mcp-code{background:#fbfbfd;border-color:rgba(0,0,0,.1)}
[data-theme="light"] .mcp-code-bar{border-bottom-color:rgba(0,0,0,.08)}
[data-theme="light"] .mcp-code-bar span{color:#6a6a74}
[data-theme="light"] .mcp-code-bar .cp{color:#ea6a2c}
[data-theme="light"] .mcp-code pre{color:#3f3f4a}
[data-theme="light"] .mcp-code .s{color:#0d8f5b}
[data-theme="light"] .mcp-code .k{color:#c2571a}
[data-theme="light"] .mcp-code .c{color:#a2a2ab}
.mcp-setup{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.mcp-steps{display:flex;flex-direction:column;gap:16px}
.mcp-step{display:flex;gap:14px}
.mcp-step .n{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font:800 14px/1 'JetBrains Mono',monospace;color:#fff;background:linear-gradient(180deg,var(--accent-2,#ff894c),var(--accent));flex-shrink:0}
.mcp-step h4{font-size:15.5px;font-weight:700;color:var(--text);margin:3px 0 3px}
.mcp-step p{font-size:13.5px;line-height:1.5;color:var(--text-muted);margin:0}
.mcp-code{background:#0d0d12;border:1px solid var(--border);border-radius:14px;overflow:hidden}
.mcp-code-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
.mcp-code-bar span{font:600 12px/1 'JetBrains Mono',monospace;color:#a5a4ac}
.mcp-code-bar .cp{font:600 11px/1 'JetBrains Mono',monospace;color:var(--accent-2,#ff894c);cursor:pointer}
.mcp-code pre{margin:0;padding:16px 18px;font:500 12.5px/1.7 'JetBrains Mono',monospace;color:#e9e7f5;overflow-x:auto}
.mcp-code .k{color:#ff9a5c}.mcp-code .s{color:#7fdca0}.mcp-code .c{color:#6e6d78}
.mcp-code-bar .cp{display:inline-flex;align-items:center;gap:5px}.mcp-code-bar .cp svg{width:12px;height:12px}
.mcp-orlabel{font-size:13.5px;font-weight:600;color:var(--text-soft);margin:0 0 12px}
.mcp-orlabel code{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-muted);background:var(--surface-2);padding:2px 6px;border-radius:5px}
.mcp-setup .mcp-term-body{font-size:12.5px}
.mcp-security{background:linear-gradient(150deg,var(--accent-soft),transparent 62%),var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px 28px;display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center}
.mcp-security .mcp-ic{width:52px;height:52px;margin:0}
.mcp-security h3{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--text);margin:0 0 6px}
.mcp-security p{font-size:14.5px;line-height:1.6;color:var(--text-muted);margin:0;max-width:80ch}
.mcp-security b{color:var(--text)}
/* ===== reference-style rich hero (dark banner, ember-adapted) ===== */
.lxh{position:relative;overflow:hidden;border-radius:26px;background:#08080c;border:1px solid rgba(255,255,255,.06);margin-bottom:58px;isolation:isolate}
.lxh-grid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:50px 50px;-webkit-mask-image:radial-gradient(ellipse at 28% 22%,#000 12%,transparent 68%);mask-image:radial-gradient(ellipse at 28% 22%,#000 12%,transparent 68%)}
.lxh-glow{position:absolute;border-radius:50%;filter:blur(110px);z-index:0;pointer-events:none}
.lxh-glow.g1{top:-12%;left:-12%;width:520px;height:520px;background:rgba(234,106,44,.18);animation:lxh-pulse 6s ease-in-out infinite}
.lxh-glow.g2{bottom:-22%;right:-8%;width:440px;height:440px;background:rgba(255,154,61,.13);animation:lxh-pulse 6s ease-in-out infinite 3s}
.lxh-glow.g3{top:38%;left:44%;width:620px;height:620px;background:rgba(255,196,80,.05);animation:lxh-pulse 6s ease-in-out infinite 1.5s}
@keyframes lxh-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
.lxh-particles{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.lxh-particles i{position:absolute;bottom:-8px;width:2px;height:2px;border-radius:50%;background:#ea6a2c;animation:lxh-particle linear infinite}
@keyframes lxh-particle{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-580px) translateX(20px);opacity:0}}
.lxh-in{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1.02fr;gap:52px;align-items:center;padding:68px 60px}
.lxh-l{max-width:560px}
.lxh-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;background:rgba(255,154,61,.1);border:1px solid rgba(255,154,61,.24);box-shadow:0 0 12px rgba(255,154,61,.14);margin-bottom:22px}
.lxh-badge i{width:7px;height:7px;border-radius:50%;background:#ff9a3d;animation:lxh-blink 2s ease-in-out infinite}
.lxh-badge span{font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#ff9a3d}
@keyframes lxh-blink{0%,100%{opacity:1}50%{opacity:.35}}
.lxh h1{font-size:68px;line-height:.95;font-weight:800;letter-spacing:-.035em;color:#fff;margin:0}
.lxh h1 .grad{background:linear-gradient(100deg,#ea6a2c,#ff9a3d,#fff);-webkit-background-clip:text;background-clip:text;color:transparent}
.lxh-sub{font-size:18px;line-height:1.6;font-weight:400;color:#a7a7b0;margin:20px 0 0;max-width:410px}
.lxh-install{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;background:rgba(20,20,26,.82);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);margin-top:26px;max-width:404px;cursor:pointer;transition:border-color .25s,background .25s,box-shadow .25s}
.lxh-install:hover{border-color:rgba(234,106,44,.42);background:rgba(234,106,44,.05);box-shadow:0 0 26px rgba(234,106,44,.12)}
.lxh-install .p{color:#52525b;font:500 14px/1 'JetBrains Mono',monospace}
.lxh-install code{flex:1;font:500 14px/1 'JetBrains Mono',monospace;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lxh-install .ci{color:#52525b;transition:color .2s;display:inline-flex}.lxh-install:hover .ci{color:#ea6a2c}
.lxh-install .ci svg{width:16px;height:16px}
.lxh-install .done{display:none;font:600 12px/1 'JetBrains Mono',monospace;color:#ff9a3d}
.lxh-install.copied .ci{display:none}.lxh-install.copied .done{display:inline}
.lxh-btns{display:flex;flex-wrap:wrap;gap:14px;margin-top:26px}
.lxh-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 26px;border-radius:12px;font:700 13px/1 'Hanken Grotesk',sans-serif;letter-spacing:.03em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:transform .25s,box-shadow .25s,background .25s,border-color .25s}
.lxh-btn svg{width:16px;height:16px}
.lxh-btn.p{background:#ea6a2c;color:#fff;box-shadow:0 0 28px rgba(234,106,44,.34)}
.lxh-btn.p:hover{box-shadow:0 0 46px rgba(234,106,44,.5);transform:translateY(-2px)}
.lxh-btn.s{background:rgba(255,255,255,.05);color:#fff;border:1px solid rgba(255,255,255,.15)}
.lxh-btn.s:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.09);transform:translateY(-2px)}
.lxh-stats{display:flex;align-items:flex-start;gap:26px;margin-top:38px;padding-top:26px;border-top:1px solid rgba(255,255,255,.07)}
.lxh-stats .v{font:800 22px/1 'JetBrains Mono',monospace;color:#fff;display:flex;align-items:center;gap:7px}
.lxh-stats .l{font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:.09em;margin-top:7px}
.lxh-stats .dv{width:1px;height:38px;background:rgba(255,255,255,.1)}
.lxh-stats .live{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:lxh-dot 2s ease-in-out infinite}
@keyframes lxh-dot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}50%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}
.lxh-term{position:relative;border-radius:16px;overflow:hidden;background:rgba(10,10,14,.92);border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(255,154,61,.14),0 0 44px rgba(234,106,44,.09),0 26px 54px rgba(0,0,0,.55);animation:lxh-float 6s ease-in-out infinite}
@keyframes lxh-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.lxh-term.win{box-shadow:0 0 0 1px rgba(34,197,94,.32),0 0 60px rgba(34,197,94,.16),0 26px 54px rgba(0,0,0,.55)}
.lxh-tbar{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
.lxh-tbar .dots{display:flex;gap:7px}.lxh-tbar .dots i{width:12px;height:12px;border-radius:50%}
.lxh-tbar .dots i:nth-child(1){background:#ff5f57}.lxh-tbar .dots i:nth-child(2){background:#febc2e}.lxh-tbar .dots i:nth-child(3){background:#28c840}
.lxh-tbar .nm{display:flex;align-items:center;gap:7px;font:500 12px/1 'JetBrains Mono',monospace;color:#52525b}.lxh-tbar .nm svg{width:12px;height:12px}
.lxh-tbody{position:relative;padding:22px;font:500 13px/1.85 'JetBrains Mono',monospace;min-height:302px;overflow:hidden}
.lxh-tbody .lxh-dim{color:#69748e}.lxh-tbody .lxh-sec{color:#a7a7b0}.lxh-tbody .lxh-em{color:#ea6a2c}.lxh-tbody .lxh-ok{color:#43d38a}.lxh-tbody .lxh-warn{color:#facc15}.lxh-tbody .lxh-w{color:#fff}.lxh-tbody .lxh-p{color:#ff9a3d}.lxh-tbody .sm{font-size:12px}
.lxh-pgt{width:240px;height:6px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden}
.lxh-scan{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,154,61,.45),transparent);animation:lxh-scan 4s ease-in-out infinite 2s;top:0;pointer-events:none}
@keyframes lxh-scan{0%{top:0;opacity:0}10%{opacity:.6}90%{opacity:.6}100%{top:100%;opacity:0}}
.lxh-tline{opacity:0;transform:translateX(-6px);transition:opacity .35s ease,transform .35s ease}
.lxh-tline.show{opacity:1;transform:translateX(0)}
.lxh-cursor{display:flex;align-items:center;gap:8px;opacity:0;margin-top:8px}
.lxh-cursor .c{width:9px;height:18px;background:rgba(255,154,61,.8);animation:lxh-cblink 1s step-end infinite}
@keyframes lxh-cblink{0%,50%{opacity:1}51%,100%{opacity:0}}
.lxh-anim{opacity:0;transform:translateY(24px);filter:blur(6px);transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1),filter .9s cubic-bezier(.16,1,.3,1)}
.lxh-anim.vis{opacity:1;transform:none;filter:blur(0)}
@media(prefers-reduced-motion:reduce){.lxh-glow,.lxh-particles i,.lxh-term,.lxh-badge i,.lxh-scan,.lxh-stats .live{animation:none}.lxh-anim{opacity:1;transform:none;filter:none}}
@media(max-width:900px){.lxh-in{grid-template-columns:1fr;padding:32px 22px;gap:32px}.lxh h1{font-size:40px}}

@media(max-width:1080px){.mcp-feat{grid-template-columns:1fr 1fr}}
@media(max-width:900px){.mcp-hero,.mcp-setup{grid-template-columns:1fr}.mcp-feat,.mcp-cmds{grid-template-columns:1fr}.mcp-hero h1{font-size:36px}}
@media(max-width:560px){.mcp-wrap{padding:2px 0 96px}.mcp-hero{margin-bottom:40px}.mcp-hero h1{font-size:29px}.mcp-hero p{font-size:15px}.mcp-sec{margin-bottom:40px}.mcp-sec-head h2{font-size:23px}.mcp-stats{gap:20px}.mcp-stats b{font-size:19px}.mcp-term-body,.mcp-code pre{font-size:11.5px}.mcp-security{grid-template-columns:1fr}.mcp-btn{flex:1 1 100%;justify-content:center}}
</style>`;

function chip(icon){ return `<div class="mcp-ic">${icon}</div>`; }
function feat(cls,icon,title,desc){ return `<div class="fcard ${cls}"><div class="fic">${icon}</div><h3>${title}</h3><div class="ul"></div><p>${desc}</p></div>`; }
function cmd(icon,name,desc,write){ return `<div class="cmd2 ${write?'write':'read'}"><span class="cic">${icon}</span><div class="cbody"><code>${name}</code><div class="cd">${desc}</div></div><span class="ctag"></span></div>`; }

function mainHTML(cfg){
  const N=cfg.name, A=cfg.nat;
  const CP=`<span class="cp" data-mcp-copy>${I.copy}Copy</span>`;
  return `<main class="page"><div class="mcp-wrap">
<div class="mcp-crumb"><a href="lumoscore-home.html">Home</a> <span>/</span> MCP CLI</div>

<section class="lxh">
  <div class="lxh-grid"></div>
  <div class="lxh-glow g1"></div><div class="lxh-glow g2"></div><div class="lxh-glow g3"></div>
  <div class="lxh-particles" id="lxhParticles"></div>
  <div class="lxh-in">
    <div class="lxh-l" id="lxhLeft">
      <div class="lxh-anim" data-d="0"><div class="lxh-badge"><i></i><span>MCP Server for ${N}</span></div></div>
      <h1 class="lxh-anim" data-d="120">Your AI agent,<br><span class="grad">on-chain.</span></h1>
      <p class="lxh-sub lxh-anim" data-d="240">Connect your AI agent to LumosCore on ${N}. Trade, seed liquidity, launch tokens, bridge across chains, manage your wallet, and claim LUMOS rewards &mdash; all in natural language.</p>
      <div class="lxh-anim" data-d="360"><div class="lxh-install" data-copy="npm i -g @lumoscore/mcp"><span class="p">$</span><code>npm i -g @lumoscore/mcp</code><span class="ci">${I.copy}</span><span class="done">Copied!</span></div></div>
      <div class="lxh-btns lxh-anim" data-d="480"><a class="lxh-btn p" href="#mcp-tools">${I.term}Get Started</a><a class="lxh-btn s" href="#mcp-tools">${I.book}Documentation</a></div>
      <div class="lxh-stats lxh-anim" data-d="600">
        <div><div class="v">10</div><div class="l">Commands</div></div>
        <div class="dv"></div>
        <div><div class="v">7</div><div class="l">Networks</div></div>
        <div class="dv"></div>
        <div><div class="v"><span class="live"></span>Live</div><div class="l">Mainnet</div></div>
      </div>
    </div>
    <div class="lxh-r">
      <div class="lxh-term" id="lxhTerm">
        <div class="lxh-tbar"><div class="dots"><i></i><i></i><i></i></div><div class="nm">${I.term}lumoscore-mcp</div><span style="width:44px"></span></div>
        <div class="lxh-tbody"><div class="lxh-scan"></div><div id="lxhLines"></div><div class="lxh-cursor" id="lxhCursor"><span style="color:#ff9a3d">❯</span><span class="c"></span></div></div>
      </div>
    </div>
  </div>
</section>
<script id="lx-mcp-hero">(function(){
var LINK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
var lines=document.getElementById('lxhLines'),cursor=document.getElementById('lxhCursor'),term=document.getElementById('lxhTerm');
var TO=[];
function wait(ms){return new Promise(function(r){TO.push(setTimeout(r,ms));});}
function mk(html){var d=document.createElement('div');d.className='lxh-tline';d.innerHTML=html;lines.appendChild(d);requestAnimationFrame(function(){d.classList.add('show');});return d;}
function type(el,txt,sp){return new Promise(function(res){var i=0;el.textContent='';(function t(){if(i<txt.length){el.textContent+=txt[i++];TO.push(setTimeout(t,sp));}else res();})();});}
var steps=[
 {t:'in',x:'lumoscore mcp start',d:400},
 {t:'tx',x:'→ Starting LumosCore MCP server…',c:'lxh-dim',d:520},
 {t:'tx',x:'✓ Connected to ${N} mainnet',c:'lxh-ok',d:460},
 {t:'tx',x:'→ Loaded 10 tools · key lx_live_••••',c:'lxh-dim',d:420},
 {t:'sp',d:160},
 {t:'tx',x:'🤖 Swap 500 ${A} for USDC',c:'lxh-sec',d:680},
 {t:'sp',d:120},
 {t:'tx',x:'⚡ Calling swap_tool…',c:'lxh-em',d:460},
 {t:'tx',x:'   from: ${A} · amount: 500 · to: USDC',c:'lxh-dim',sm:1,d:300},
 {t:'tx',x:'◉ Pending approval…',c:'lxh-warn',d:560,id:'lxhPend'},
 {t:'pg',d:1400},
 {t:'rep',id:'lxhPend',x:'✓ Approved · Executing…',c:'lxh-ok',d:420},
 {t:'sp',d:100},
 {t:'ok',x:'500 ${A} → 1,247.82 USDC',d:560},
 {t:'ln',x:'View on ${N}Scan',d:420}
];
function run(){
 var i=0;
 function next(){
  if(i>=steps.length){ wait(300).then(function(){if(cursor)cursor.style.opacity='1';}); return; }
  var s=steps[i++];
  wait(s.d||400).then(function(){
   if(s.t==='in'){var d=mk('');var pr=document.createElement('span');pr.className='lxh-p';pr.style.marginRight='8px';pr.textContent='❯';var tx=document.createElement('span');tx.className='lxh-w';d.appendChild(pr);d.appendChild(tx);type(tx,s.x,38).then(next);return;}
   else if(s.t==='tx'){var el=mk('<span class="'+s.c+(s.sm?' sm':'')+'">'+s.x+'</span>');if(s.id)el.id=s.id;}
   else if(s.t==='rep'){var e=document.getElementById(s.id);if(e){e.style.transition='opacity .2s';e.style.opacity='0';wait(200).then(function(){e.innerHTML='<span class="'+s.c+'">'+s.x+'</span>';e.style.opacity='1';next();});return;}}
   else if(s.t==='sp'){mk('').style.height='10px';}
   else if(s.t==='pg'){var w=mk('<div style="padding-left:26px;margin-top:2px"><div class="lxh-pgt"><div class="lxh-pg" style="height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#ea6a2c,#ff9a3d);transition:width 1.3s cubic-bezier(.4,0,.2,1)"></div></div></div>');wait(60).then(function(){var tr=w.querySelector('.lxh-pg');if(tr)tr.style.width='100%';next();});return;}
   else if(s.t==='ok'){mk('<div style="display:flex;align-items:flex-start;gap:8px"><span class="lxh-ok" style="font-size:17px;line-height:19px">✓</span><div><div class="lxh-ok" style="font-weight:600">Swap complete!</div><div class="lxh-dim" style="font-size:12px;margin-top:2px">'+s.x+'</div></div></div>');if(term)term.classList.add('win');}
   else if(s.t==='ln'){mk('<div style="padding-left:26px;margin-top:4px"><a href="#" class="lxh-em" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;text-decoration:none">'+LINK+s.x+'</a></div>');}
   next();
  });
 }
 next();
}
function entrance(){var els=document.querySelectorAll('#lxhLeft .lxh-anim');for(var i=0;i<els.length;i++){(function(el){var dd=+el.getAttribute('data-d')||0;setTimeout(function(){el.classList.add('vis');},dd+150);})(els[i]);}}
var pc=document.getElementById('lxhParticles');
if(pc){for(var i=0;i<18;i++){var p=document.createElement('i');p.style.left=(Math.random()*100)+'%';p.style.animationDuration=(8+Math.random()*10)+'s';p.style.animationDelay=(Math.random()*10)+'s';var sz=(1+Math.random()*2);p.style.width=sz+'px';p.style.height=sz+'px';if(Math.random()>0.5)p.style.background='#ff9a3d';pc.appendChild(p);}}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('.lxh-install'):null;if(!b)return;var t=b.getAttribute('data-copy')||'';if(navigator.clipboard)navigator.clipboard.writeText(t);b.classList.add('copied');setTimeout(function(){b.classList.remove('copied');},1800);});
function boot(){entrance();if(lines)run();}
if(document.readyState!=='loading')boot();else window.addEventListener('load',boot);
})();</script>

<section class="mcp-sec" data-lx-noswap>
  <div class="mcp-sec-head">
    <h2>Six capabilities, one agent</h2>
    <p>Everything in LumosCore is exposed to your AI agent as MCP tools &mdash; reads return instantly, and every on-chain write comes back to you for a signature.</p>
  </div>
  <div class="mcp-feat">
    ${feat('fc-ember',I.quote,'Trade','Orderbook and swap in one place. Rest a limit order on the on-chain book, or take the best route across orderbook and AMM liquidity.')}
    ${feat('fc-iris',I.drop,'Pools','Create or join an AMM liquidity pool between any two assets and earn a share of every trade that routes through it.')}
    ${feat('fc-teal',I.rocket,'Launchpad','Mint a brand-new token and seed its initial liquidity in a single guided, signed flow.')}
    ${feat('fc-ember',I.bridge,'Cross-chain','Move assets between networks through the bridge best-suited to each chain.')}
    ${feat('fc-iris',I.wallet,'Wallet','Read your portfolio, assets and activity, then send, receive or swap &mdash; the agent drafts, you sign.')}
    ${feat('fc-teal',I.gift,'Rewards','Track your eligibility and claim your share across all three LUMOS incentive programs.')}
  </div>
</section>

<section class="mcp-sec" id="mcp-tools">
  <div class="mcp-cmdhead">
    <div class="k">Commands</div>
    <h2>Ten commands, <span class="g">one server</span></h2>
    <p>Read commands run instantly. Every write returns to you for a signature &mdash; nothing moves without approval.</p>
  </div>
  <div class="mcp-cmds">
    ${cmd(I.search,'get_quote','Best-route price for any pair, with impact and fees.',false)}
    ${cmd(I.swap,'swap','Execute a swap at the best route across orderbook and AMM.',true)}
    ${cmd(I.drop,'add_liquidity','Deposit a token pair into an AMM pool and earn fees.',true)}
    ${cmd(I.minus,'remove_liquidity','Withdraw your position and collect accrued fees.',true)}
    ${cmd(I.bridge,'bridge','Move assets across networks via the best bridge for each chain.',true)}
    ${cmd(I.rocket,'launch_token','Create and list a new token, with initial liquidity.',true)}
    ${cmd(I.layers,'list_pools','Browse pools by TVL, volume, APR, or asset.',false)}
    ${cmd(I.gift,'get_rewards','Check and claim across all three LUMOS reward programs.',false)}
    ${cmd(I.pie,'get_portfolio','Balances, LP positions, and open orders in one call.',false)}
    ${cmd(I.quote,'get_market','Live price, volume, and trend for any listed asset.',false)}
  </div>
</section>

</div></main>`;
}

// copy-button wiring (tiny, self-contained)
const COPYJS='<script id="lx-mcp-copy">(function(){document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-mcp-copy]"):null;if(!b)return;var txt=b.getAttribute("data-copy");if(!txt){var box=b.closest(".mcp-code");var pre=box&&box.querySelector("pre");txt=pre?pre.textContent:"";}if(txt&&navigator.clipboard){navigator.clipboard.writeText(txt);var o=b.innerHTML;b.textContent="Copied";setTimeout(function(){b.innerHTML=o;},1400);}});})();</script>';

// mobile menu MCP anchor (dead href="#") -> wire to the mobile MCP page
const MCPMOB_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.9 4.9l2.8 2.8"/><path d="M16.3 16.3l2.8 2.8"/><path d="M2 12h4"/><path d="M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>';
const MCPMOB_OLD='<a href="#">'+MCPMOB_SVG+'MCP</a>';
const MCPMOB_NEW='<a href="lumoscore-mcp-mobile.html">'+MCPMOB_SVG+'MCP</a>';

const DEV={
  desktop:{ tmpl:'lumoscore-wallet.html', out:'lumoscore-mcp.html',
    active:p=>p.replace('class="nx-item active" data-id="wallet"','class="nx-item" data-id="wallet"').replace('class="nx-item" data-id="mcp"','class="nx-item active" data-id="mcp"'),
    wire:b=>b.split('data-id="mcp" href="#"').join('data-id="mcp" href="lumoscore-mcp.html"') },
  mobile:{ tmpl:'lumoscore-wallet-mobile.html', out:'lumoscore-mcp-mobile.html',
    active:p=>p,
    wire:b=>b.split(MCPMOB_OLD).join(MCPMOB_NEW) },
};

let made=0, wired=0;
for(const chain of Object.keys(CFG)){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${chain}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    const D=DEV[dev];
    if(json[D.tmpl]){
      let page=json[D.tmpl];
      page=page.replace(/<main class="page">[\s\S]*?<\/main>/, mainHTML(CFG[chain]));
      // STYLE goes in <head> so it's render-blocking — otherwise the CSS-sized inline icons
      // (esp. the badge SVG) flash at their huge default size before a body-end <style> loads.
      if(page.indexOf('</head>')>=0){ page=page.replace('</head>', STYLE+'</head>'); }
      else { const hb=page.lastIndexOf('</body>'); page=page.slice(0,hb)+STYLE+page.slice(hb); }
      const bi=page.lastIndexOf('</body>');
      page=page.slice(0,bi)+COPYJS+page.slice(bi);
      page=page.replace(/<title>[\s\S]*?<\/title>/,'<title>LumosCore — MCP</title>');
      page=D.active(page);
      json[D.out]=page; made++;
    }
    for(const k of Object.keys(json)){
      const b=json[k]; const nb=D.wire(b);
      if(nb!==b){ json[k]=nb; wired++; }
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log('MCP page: built='+made+' navWired(pages)='+wired);
