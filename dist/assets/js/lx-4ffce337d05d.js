/* LumosCore connect-wallet modal — Aptos, self-contained. Exposes window.lxwOpenWallet(net, home). */
(function(){
  if (window.__lxw) return; window.__lxw = true;

  var CHEV='<svg class="lxw-wchev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var CLOSE='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // wallet icon SVGs
  var I={freighter:'<span class="lx-wl">F</span><img class="lx-wimg" src="/assets/wallets/freighter.png" alt="" onerror="this.remove()">',xbull:'<span class="lx-wl">X</span>',rabet:'<span class="lx-wl">R</span><img class="lx-wimg" src="/assets/wallets/rabet.jpg" alt="" onerror="this.remove()">',albedo:'<span class="lx-wl">A</span><img class="lx-wimg" src="/assets/wallets/albedo.png" alt="" onerror="this.remove()">',lobstr:'<span class="lx-wl">L</span><img class="lx-wimg" src="/assets/wallets/lobstr.png" alt="" onerror="this.remove()">',wc:'<span class="lx-wl">W</span>',gem:'<span class="lx-wl">G</span><img class="lx-wimg" src="/assets/wallets/gem.png" alt="" onerror="this.remove()">',xaman:'<span class="lx-wl">X</span><img class="lx-wimg" src="/assets/wallets/xaman.png" alt="" onerror="this.remove()">',joey:'<span class="lx-wl">J</span>',crossmark:'<span class="lx-wl">C</span><img class="lx-wimg" src="/assets/wallets/crossmark.webp" alt="" onerror="this.remove()">',hashpack:'<span class="lx-wl">H</span><img class="lx-wimg" src="/assets/wallets/hashpack.png" alt="" onerror="this.remove()">',kabila:'<span class="lx-wl">K</span><img class="lx-wimg" src="/assets/wallets/kabila.png" alt="" onerror="this.remove()">',blade:'<span class="lx-wl">B</span>',metamask:'<span class="lx-wl">M</span>',argent:'<span class="lx-wl">R</span><img class="lx-wimg" src="/assets/wallets/ready.png" alt="" onerror="this.remove()">',braavos:'<span class="lx-wl">B</span>',petra:'<span class="lx-wl">P</span>',martian:'<span class="lx-wl">M</span>',pontem:'<span class="lx-wl">P</span>',veworld:'<span class="lx-wl">V</span>',sync2:'<span class="lx-wl">S</span>',coinbase:'<span class="lx-wl">C</span>',rainbow:'<span class="lx-wl">R</span>'};

  // network -> {label, chip, addr, groups:[{section, wallets:[{id,name,sub,grad,icon,installed}]}]}
  var NETS={
    stellar:{ label:'Aptos', chip:'Aptos', addr:'0x0d99…36da', sub:'Choose a wallet to continue', groups:[
      {section:'Popular', wallets:[
        {id:'Freighter',name:'Freighter',sub:'Browser extension',grad:'linear-gradient(135deg,#8b5cf6 0%,#5b1cc4 100%)',icon:I.freighter},
        {id:'xBull',name:'xBull',sub:'Browser extension',grad:'linear-gradient(135deg,#a855f7 0%,#6d28d9 100%)',icon:I.xbull}
      ]},
      {section:'All wallets', wallets:[
        {id:'Rabet',name:'Rabet',sub:'Browser extension',grad:'linear-gradient(135deg,#1f2937 0%,#0b1220 100%)',icon:I.rabet},
        {id:'Albedo',name:'Albedo',sub:'Web wallet · No install',grad:'linear-gradient(135deg,#0ea5e9 0%,#0c4a6e 100%)',icon:I.albedo},
        {id:'LOBSTR',name:'LOBSTR',sub:'Mobile & web',grad:'linear-gradient(135deg,#fb7185 0%,#be123c 100%)',icon:I.lobstr},
        {id:'WalletConnect',name:'WalletConnect',sub:'Universal · 300+ mobile wallets',grad:'linear-gradient(135deg,#3b99fc 0%,#1e40af 100%)',icon:I.wc}
      ]}
    ]},
    xrpl:{ label:'aBTC', chip:'aBTC', addr:'0x0e96…f9c2', sub:'Choose an Aptos wallet to continue', groups:[
      {section:'Popular', wallets:[
        {id:'Gem',name:'Gem Wallet',sub:'Browser extension',grad:'linear-gradient(135deg,#22c55e 0%,#15803d 100%)',icon:I.gem,installed:true},
        {id:'Xaman',name:'Xaman',sub:'Mobile app',grad:'linear-gradient(135deg,#2563eb 0%,#0b1220 100%)',icon:I.xaman}
      ]},
      {section:'All wallets', wallets:[
        {id:'Joey',name:'Joey',sub:'Mobile',grad:'linear-gradient(135deg,#ec4899 0%,#a21caf 100%)',icon:I.joey},
        {id:'Crossmark',name:'Crossmark',sub:'Browser extension',grad:'linear-gradient(135deg,#f59e0b 0%,#b45309 100%)',icon:I.crossmark}
      ]}
    ]}
  ,hedera:{label:'Hedera',chip:'Hedera',addr:'0.0.2754435',sub:'Choose a wallet to continue',groups:[{section:'Popular',wallets:[{id:'HashPack',name:'HashPack',sub:'Browser & mobile',grad:'linear-gradient(135deg,#8259ef 0%,#5b2fd6 100%)',icon:I.hashpack,installed:true},{id:'Kabila',name:'Kabila',sub:'Web & mobile',grad:'linear-gradient(135deg,#16c79a 0%,#0b8f6e 100%)',icon:I.kabila}]},{section:'More wallets',wallets:[{id:'Blade',name:'Blade',sub:'Browser extension',grad:'linear-gradient(135deg,#111827 0%,#0b1220 100%)',icon:I.blade},{id:'MetaMask',name:'MetaMask',sub:'Via Hedera Snap',grad:'linear-gradient(135deg,#f6851b 0%,#c85a11 100%)',icon:I.metamask},{id:'WalletConnect',name:'WalletConnect',sub:'Scan to connect',grad:'linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)',icon:I.wc}]}]},starknet:{label:'Starknet',chip:'Starknet',addr:'0x04a7...9c2f',sub:'Choose a wallet to continue',groups:[{section:'Popular',wallets:[{id:'Ready',name:'Ready',sub:'Browser & mobile',grad:'linear-gradient(135deg,#ff875b 0%,#e0417a 100%)',icon:I.argent,installed:true},{id:'Braavos',name:'Braavos',sub:'Browser extension',grad:'linear-gradient(135deg,#f4923d 0%,#c2410c 100%)',icon:I.braavos}]},{section:'More wallets',wallets:[{id:'WalletConnect',name:'WalletConnect',sub:'Scan to connect',grad:'linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)',icon:I.wc}]}]},aptos:{label:'Aptos',chip:'Aptos',addr:'0x9c7d...a802',sub:'Choose a wallet to continue',groups:[{section:'Popular',wallets:[{id:'Petra',name:'Petra',sub:'Browser & mobile',grad:'linear-gradient(135deg,#2ed3b7 0%,#0b8f6e 100%)',icon:I.petra,installed:true},{id:'Martian',name:'Martian',sub:'Browser extension',grad:'linear-gradient(135deg,#6b4df6 0%,#3b1cc4 100%)',icon:I.martian}]},{section:'More wallets',wallets:[{id:'Pontem',name:'Pontem',sub:'Browser extension',grad:'linear-gradient(135deg,#0ea5e9 0%,#0c4a6e 100%)',icon:I.pontem},{id:'WalletConnect',name:'WalletConnect',sub:'Scan to connect',grad:'linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)',icon:I.wc}]}]},vechain:{label:'VeChain',chip:'VeChain',addr:'0x5f2c...b18a',sub:'Choose a wallet to continue',groups:[{section:'Popular',wallets:[{id:'VeWorld',name:'VeWorld',sub:'Browser & mobile',grad:'linear-gradient(135deg,#4a5bdb 0%,#27b4e6 100%)',icon:I.veworld,installed:true},{id:'Sync2',name:'Sync2',sub:'Desktop app',grad:'linear-gradient(135deg,#16c79a 0%,#0b8f6e 100%)',icon:I.sync2}]},{section:'More wallets',wallets:[{id:'WalletConnect',name:'WalletConnect',sub:'Scan to connect',grad:'linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)',icon:I.wc}]}]},worldchain:{label:'World Chain',chip:'World Chain',addr:'0x81be...4f3d',sub:'Choose a wallet to continue',groups:[{section:'Popular',wallets:[{id:'MetaMask',name:'MetaMask',sub:'Browser & mobile',grad:'linear-gradient(135deg,#f6851b 0%,#c85a11 100%)',icon:I.metamask,installed:true},{id:'Coinbase Wallet',name:'Coinbase Wallet',sub:'Web & mobile',grad:'linear-gradient(135deg,#2563eb 0%,#1e40af 100%)',icon:I.coinbase}]},{section:'More wallets',wallets:[{id:'Rainbow',name:'Rainbow',sub:'Mobile wallet',grad:'linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%)',icon:I.rainbow},{id:'WalletConnect',name:'WalletConnect',sub:'Scan to connect',grad:'linear-gradient(135deg,#3b99fc 0%,#1a6fd4 100%)',icon:I.wc}]}]}};

  var CSS=''
   +'.lxw-bd{position:fixed;inset:0;z-index:100000;background:rgba(8,8,12,.62);backdrop-filter:blur(8px) saturate(140%);-webkit-backdrop-filter:blur(8px) saturate(140%);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;animation:lxwFade .2s ease-out forwards;}'
   +'.lxw-bd[hidden]{display:none;}@keyframes lxwFade{to{opacity:1;}}'
   +'.lxw-modal{background:var(--surface,#14141b);border:1px solid var(--border,rgba(255,255,255,.09));border-radius:18px;width:100%;max-width:460px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;color:var(--text,#ECECF3);box-shadow:0 22px 60px -8px rgba(0,0,0,.5),0 8px 24px -12px rgba(0,0,0,.5);transform:scale(.94) translateY(8px);animation:lxwSlide .26s cubic-bezier(.16,.84,.32,1.18) forwards;font-family:inherit;}'
   +'@keyframes lxwSlide{to{transform:scale(1) translateY(0);}}'
   +'.lxw-screen{display:flex;flex-direction:column;min-height:0;}.lxw-screen[hidden]{display:none;}'
   +'.lxw-head{display:flex;align-items:flex-start;gap:12px;padding:18px 22px 14px;border-bottom:1px solid var(--border,rgba(255,255,255,.09));}'
   +'.lxw-htitles{flex:1;min-width:0;}.lxw-head h3{margin:0 0 2px;font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--text,#ECECF3);}'
   +'.lxw-sub{margin:0;font-size:14.5px;color:var(--text-muted,#9a9aab);font-weight:500;line-height:1.4;}'
   +'.lxw-close{width:30px;height:30px;border-radius:9px;background:transparent;border:1px solid var(--border,rgba(255,255,255,.09));color:var(--text-muted,#9a9aab);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}'
   +'.lxw-close:hover{background:var(--surface-2,rgba(255,255,255,.05));color:var(--text,#fff);}'
   +'.lxw-search{position:relative;padding:14px 22px 4px;}.lxw-search svg{position:absolute;left:34px;top:50%;transform:translateY(-30%);color:var(--text-soft,#7c7c8a);pointer-events:none;}'
   +'.lxw-search input{width:100%;padding:9px 12px 9px 34px;background:var(--surface-2,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.09));border-radius:10px;font-family:inherit;font-size:15px;color:var(--text,#ECECF3);font-weight:500;outline:none;box-sizing:border-box;transition:border-color .15s;}'
   +'.lxw-search input:focus{border-color:var(--accent,#f7861b);}.lxw-search input::placeholder{color:var(--text-soft,#7c7c8a);}'
   +'.lxw-list{flex:1;min-height:0;overflow-y:auto;padding:8px 14px 6px;scrollbar-width:thin;}'
   +'.lxw-group{padding:8px 0;}.lxw-section{padding:6px 10px 8px;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-soft,#7c7c8a);}'
   +'.lxw-row{width:100%;display:flex;align-items:center;gap:13px;padding:10px;background:transparent;border:1px solid transparent;border-radius:12px;cursor:pointer;text-align:left;font-family:inherit;transition:background .14s,border-color .14s,transform .14s;}'
   +'.lxw-row:hover{background:var(--surface-2,rgba(255,255,255,.05));border-color:var(--border,rgba(255,255,255,.09));}.lxw-row:active{transform:scale(.99);}'
   +'.lxw-ico{width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 4px 10px -4px rgba(0,0,0,.35);}'
   +'.lxw-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}'
   +'.lxw-name{font-size:16.5px;font-weight:700;color:var(--text,#ECECF3);letter-spacing:-.1px;}'
   +'.lxw-wsub{font-size:13.5px;color:var(--text-soft,#7c7c8a);font-weight:500;}'
   +'.lxw-badge{padding:3px 9px;border-radius:999px;font-size:12.5px;font-weight:700;letter-spacing:.03em;flex-shrink:0;background:rgba(52,210,122,.14);color:#16a34a;box-shadow:inset 0 0 0 1px rgba(52,210,122,.22);}'
   +'.lxw-wchev{color:var(--text-soft,#7c7c8a);flex-shrink:0;transition:transform .15s,color .15s;}.lxw-row:hover .lxw-wchev{color:var(--accent,#f7861b);transform:translateX(2px);}'
   +'.lxw-empty{padding:30px 20px;text-align:center;color:var(--text-soft,#7c7c8a);}.lxw-empty p{margin:8px 0 0;font-size:14.5px;font-weight:600;}'
   +'.lxw-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-top:1px solid var(--border,rgba(255,255,255,.09));font-size:13.5px;color:var(--text-muted,#9a9aab);font-weight:500;}'
   +'.lxw-foot-link{display:inline-flex;align-items:center;gap:5px;color:var(--text-muted,#9a9aab);text-decoration:none;font-weight:600;cursor:pointer;}.lxw-foot-link:hover{color:var(--accent,#f7861b);}'
   +'.lxw-foot-attr a{color:var(--text,#ECECF3);text-decoration:underline;text-underline-offset:3px;font-weight:600;}'
   +'.lxw-cstate{padding:32px 26px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;}'
   +'.lxw-cstate h4{margin:4px 0 0;font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--text,#ECECF3);}'
   +'.lxw-cstate p{margin:0;font-size:15px;line-height:1.55;color:var(--text-muted,#9a9aab);max-width:320px;font-weight:500;}'
   +'.lxw-cwallet{position:relative;width:76px;height:76px;display:flex;align-items:center;justify-content:center;}'
   +'.lxw-cwallet-ico{width:54px;height:54px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 6px 16px -4px rgba(0,0,0,.4);}'
   +'.lxw-cwallet-ico svg{width:24px;height:24px;}'
   +'.lxw-ring{position:absolute;inset:0;border:2.5px solid transparent;border-top-color:var(--accent,#f7861b);border-right-color:var(--accent,#f7861b);border-radius:50%;animation:lxwSpin 1.05s linear infinite;}@keyframes lxwSpin{to{transform:rotate(360deg);}}'
   +'.lxw-steps{display:flex;flex-direction:column;gap:6px;margin-top:6px;width:100%;max-width:240px;}'
   +'.lxw-step{display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface-2,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.09));border-radius:9px;font-size:14px;color:var(--text-muted,#9a9aab);font-weight:600;text-align:left;}'
   +'.lxw-sdot{width:8px;height:8px;border-radius:50%;background:var(--surface-3,rgba(255,255,255,.12));flex-shrink:0;}'
   +'.lxw-step.is-done{color:var(--text,#fff);}.lxw-step.is-done .lxw-sdot{background:#35c07f;box-shadow:0 0 0 3px rgba(52,210,122,.16);}'
   +'.lxw-step.is-active{color:var(--text,#fff);border-color:var(--accent,#f7861b);}.lxw-step.is-active .lxw-sdot{background:var(--accent,#f7861b);box-shadow:0 0 0 3px rgba(247,134,27,.2);animation:lxwPulse 1.2s ease-in-out infinite;}'
   +'@keyframes lxwPulse{0%,100%{box-shadow:0 0 0 3px rgba(247,134,27,.2);}50%{box-shadow:0 0 0 5px rgba(247,134,27,.1);}}'
   +'.lxw-cancel,.lxw-done{margin-top:8px;padding:9px 22px;border-radius:10px;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer;transition:all .15s;}'
   +'.lxw-cancel{background:transparent;border:1px solid var(--border,rgba(255,255,255,.09));color:var(--text-muted,#9a9aab);}.lxw-cancel:hover{color:var(--text,#fff);}'
   +'.lxw-done{background:var(--accent,#f7861b);border:1px solid var(--accent,#f7861b);color:#fff;padding:10px 28px;}.lxw-done:hover{filter:brightness(1.06);}'
   +'.lxw-checkwrap{position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;}'
   +'.lxw-cpulse{position:absolute;inset:0;border-radius:50%;background:rgba(52,210,122,.14);animation:lxwCheckPulse 1.6s ease-out infinite;}@keyframes lxwCheckPulse{0%{transform:scale(.85);opacity:.9;}100%{transform:scale(1.5);opacity:0;}}'
   +'.lxw-check{position:relative;z-index:2;width:62px;height:62px;border-radius:50%;background:rgba(52,210,122,.18);color:#35c07f;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1.5px rgba(52,210,122,.32);}'
   +'.lxw-acct{display:flex;align-items:center;gap:12px;width:100%;max-width:340px;padding:12px 14px;background:var(--surface-2,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.09));border-radius:12px;margin-top:4px;}'
   +'.lxw-acct-ico{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}'
   +'.lxw-acct-body{flex:1;min-width:0;text-align:left;}'
   +'.lxw-acct-addr{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:15px;font-weight:700;color:var(--text,#ECECF3);}'
   +'.lxw-acct-meta{display:flex;align-items:center;gap:7px;margin-top:2px;font-size:13px;color:var(--text-soft,#7c7c8a);}'
   +'.lxw-netchip{display:inline-flex;align-items:center;gap:5px;}.lxw-netdot{width:6px;height:6px;border-radius:50%;background:#35c07f;box-shadow:0 0 5px #35c07f;}'
   +'.lxw-acct-copy{background:transparent;border:none;color:var(--text-soft,#7c7c8a);cursor:pointer;display:inline-flex;flex-shrink:0;}.lxw-acct-copy:hover{color:var(--text,#fff);}';

  var modal=null, current=null, home=null;

  function build(){
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    modal=document.createElement('div'); modal.className='lxw-bd'; modal.setAttribute('hidden','');
    modal.innerHTML=
      '<div class="lxw-modal" role="dialog" aria-modal="true">'
      +'<div class="lxw-screen" data-screen="wallet">'
        +'<div class="lxw-head"><div class="lxw-htitles"><h3 class="lxw-title">Connect Wallet</h3><p class="lxw-sub"></p></div><button class="lxw-close" type="button" aria-label="Close">'+CLOSE+'</button></div>'
        +'<div class="lxw-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search wallets…" class="lxw-searchin"/></div>'
        +'<div class="lxw-list"></div>'
        +'<div class="lxw-foot"><a class="lxw-foot-link" href="https://lumoscore.com/blog/new-to-wallets-a-beginner-s-guide-to-stellar-wallets" target="_blank" rel="noopener noreferrer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>New to wallets?</a></div>'
      +'</div>'
      +'<div class="lxw-screen" data-screen="connecting" hidden>'
        +'<div class="lxw-head"><div class="lxw-htitles"><h3>Connecting…</h3></div><button class="lxw-close" type="button" aria-label="Close">'+CLOSE+'</button></div>'
        +'<div class="lxw-cstate"><div class="lxw-cwallet"><span class="lxw-cwallet-ico"></span><span class="lxw-ring"></span></div><h4 class="lxw-ctitle"></h4><p>Approve the connection request in your wallet to continue.</p>'
          +'<div class="lxw-steps"><div class="lxw-step is-done"><span class="lxw-sdot"></span>Opening wallet</div><div class="lxw-step is-active"><span class="lxw-sdot"></span>Awaiting signature</div><div class="lxw-step"><span class="lxw-sdot"></span>Finalizing</div></div>'
          +'<button class="lxw-cancel" type="button">Cancel</button></div>'
      +'</div>'
      +'<div class="lxw-screen" data-screen="connected" hidden>'
        +'<div class="lxw-head"><div class="lxw-htitles"><h3>Connected</h3></div><button class="lxw-close" type="button" aria-label="Close">'+CLOSE+'</button></div>'
        +'<div class="lxw-cstate"><div class="lxw-checkwrap"><div class="lxw-cpulse"></div><div class="lxw-check"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div></div><h4>You\'re connected</h4>'
          +'<div class="lxw-acct"><span class="lxw-acct-ico"></span><div class="lxw-acct-body"><div class="lxw-acct-addr"></div><div class="lxw-acct-meta"><span class="lxw-netchip"><span class="lxw-netdot"></span><span class="lxw-chipname"></span></span><span>·</span><span class="lxw-wnamedone"></span></div></div>'
            +'<button class="lxw-acct-copy" type="button" aria-label="Copy address"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>'
          +'<button class="lxw-done" type="button">Continue</button></div>'
      +'</div>'
      +'</div>';
    document.body.appendChild(modal);
    // listeners
    modal.addEventListener('click', function(e){ if(e.target===modal) close(); });
    modal.querySelectorAll('.lxw-close').forEach(function(b){ b.addEventListener('click', close); });
    modal.querySelector('.lxw-cancel').addEventListener('click', function(){ showScreen('wallet'); });
    modal.querySelector('.lxw-done').addEventListener('click', function(){ close(); if(home){ goHome(); } });
    modal.querySelector('.lxw-acct-copy').addEventListener('click', function(){
      var a='';try{a=localStorage.getItem('lumos.address')||'';}catch(_){}
      if(!a)a=(modal.querySelector('.lxw-acct-addr').textContent||'').trim();
      if(!window.__lxCopyTo){window.__lxCopyTo=function(text){function toast(){try{var st=document.querySelector('.toast-stack');if(!st){st=document.createElement('div');st.className='toast-stack';document.body.appendChild(st);}var fixed=false;try{fixed=(getComputedStyle(st).position==='fixed');}catch(_){}if(!fixed&&!document.getElementById('lx-copytoast-css')){var cs=document.createElement('style');cs.id='lx-copytoast-css';cs.textContent='.toast-stack{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100002;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}'+'.toast{background:#1b1e24;color:#fff;padding:11px 18px 11px 14px;border-radius:10px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:9px;box-shadow:0 12px 32px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.16);max-width:90vw}'+'.toast .check-ic{width:18px;height:18px;border-radius:50%;background:#35c07f;color:#fff;font-size:11px;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}';document.head.appendChild(cs);}try{st.style.zIndex='100002';}catch(_){}var t=document.createElement('div');t.className='toast';var ic=document.createElement('span');ic.className='check-ic';ic.textContent='✓';var tx=document.createElement('span');tx.textContent='Copied to clipboard';t.appendChild(ic);t.appendChild(tx);st.appendChild(t);setTimeout(function(){t.remove();},2200);}catch(_){}}function legacy(){try{var ta=document.createElement('textarea');ta.value=String(text);ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(ta);ta.select();try{ta.setSelectionRange(0,String(text).length);}catch(_){}var ok=document.execCommand('copy');ta.remove();return !!ok;}catch(_){return false;}}try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(toast,function(){ if(legacy())toast(); else window.prompt('Address',text); });return; } }catch(_){}if(legacy())toast(); else window.prompt('Address',text);};}
      window.__lxCopyTo(a);
    });
    modal.querySelector('.lxw-searchin').addEventListener('input', function(e){ filter(e.target.value); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !modal.hasAttribute('hidden')) close(); });
  }

  function rowHTML(w){
    return '<button class="lxw-row" type="button" data-wallet="'+w.id+'" data-search="'+(w.name+' '+w.sub).toLowerCase()+'">'
      +'<span class="lxw-ico" style="background:'+w.grad+'">'+w.icon+'</span>'
      +'<span class="lxw-main"><span class="lxw-name">'+w.name+'</span><span class="lxw-wsub">'+w.sub+'</span></span>'
      +(w.installed?'<span class="lxw-badge lxw-inst">Installed</span>':'')+CHEV+'</button>';
  }
  function renderList(net){
    var data=NETS[net], html='';
    if(!window.__lxMarkLastUsed){
      window.__lxLastWallet=function(){var v='';
        try{v=localStorage.getItem('lumos.lastWallet')||'';}catch(_){}
        if(!v){try{var cur=localStorage.getItem('lumos.wallet')||'';
          if(cur){localStorage.setItem('lumos.lastWallet',cur);v=cur;}}catch(_){}}
        return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');};
      window.__lxMarkLastUsed=function(){try{
        var last=window.__lxLastWallet();
        var rows=document.querySelectorAll('.lxw-modal .lxw-row[data-wallet]');
        for(var i=0;i<rows.length;i++){
          var id=String(rows[i].getAttribute('data-wallet')||'').toLowerCase().replace(/[^a-z0-9]/g,'');
          var on=(!!last && id===last);
          var b=rows[i].querySelector('.lxw-last');
          if(on&&!b){var sp=document.createElement('span');sp.className='lxw-badge lxw-last';sp.textContent='Last used';var iB=rows[i].querySelector('.lxw-inst');if(iB&&iB.parentNode)iB.parentNode.removeChild(iB);
            if(rows[i].lastElementChild)rows[i].insertBefore(sp,rows[i].lastElementChild);else rows[i].appendChild(sp);}
          else if(!on&&b){b.parentNode.removeChild(b);}
        }
      }catch(_){}};
    }
    var NAMES={stellar:'Stellar',xrpl:'XRP Ledger',hedera:'Hedera',aptos:'Aptos',starknet:'Starknet',vechain:'VeChain',worldchain:'World Chain'};
    var head=(NAMES[net]||(String(net||'').charAt(0).toUpperCase()+String(net||'').slice(1)))+' Wallets';
    html+='<div class="lxw-group"><div class="lxw-section">'+head+'</div>';
    data.groups.forEach(function(g){
      g.wallets.forEach(function(w){ html+=rowHTML(w); });
    });
    html+='</div>';
    html+='<div class="lxw-empty" hidden><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No wallets match that search.</p></div>';
    var list=modal.querySelector('.lxw-list'); list.innerHTML=html;
    list.querySelectorAll('.lxw-row').forEach(function(row){
      row.addEventListener('click', function(){ connect(net, row.getAttribute('data-wallet')); });
    });
  }
  function filter(q){
    q=(q||'').trim().toLowerCase();
    var rows=modal.querySelectorAll('.lxw-row'), shown=0;
    rows.forEach(function(r){ var hit=!q||r.getAttribute('data-search').indexOf(q)>-1; r.style.display=hit?'':'none'; if(hit)shown++; });
    modal.querySelectorAll('.lxw-group').forEach(function(g){ var any=g.querySelector('.lxw-row:not([style*="none"])'); });
    var empty=modal.querySelector('.lxw-empty'); if(empty){ if(shown===0) empty.removeAttribute('hidden'); else empty.setAttribute('hidden',''); }
  }
  function walletById(net,id){
    var found=null; NETS[net].groups.forEach(function(g){ g.wallets.forEach(function(w){ if(w.id===id) found=w; }); }); return found;
  }
  function connect(net, id){
    var w=walletById(net,id); if(!w) return;
    modal.querySelector('.lxw-cwallet-ico').style.background=w.grad;
    modal.querySelector('.lxw-cwallet-ico').innerHTML=w.icon;
    modal.querySelector('.lxw-ctitle').textContent='Confirming with '+w.name;
    showScreen('connecting');
    setTimeout(function(){
      var d=NETS[net];
      modal.querySelector('.lxw-acct-ico').style.background=w.grad;
      modal.querySelector('.lxw-acct-ico').innerHTML=w.icon;
      modal.querySelector('.lxw-acct-addr').textContent=d.addr;
      modal.querySelector('.lxw-chipname').textContent=d.chip;
      modal.querySelector('.lxw-wnamedone').textContent=w.name;
      try{ localStorage.setItem('lumos.wallet', w.id); localStorage.setItem('lumos.network', net); localStorage.setItem('lumos.lastWallet', w.id); }catch(_){}
      if(window.lxnsSetConnected) window.lxnsSetConnected(net, w.name);
      showScreen('connected');
    }, 1650);
  }
  function showScreen(name){
    modal.querySelectorAll('.lxw-screen').forEach(function(s){ s.toggleAttribute('hidden', s.getAttribute('data-screen')!==name); });
  }
  function close(){ if(modal) modal.setAttribute('hidden',''); }
  function goHome(){ try{ var a=document.createElement('a'); a.href=home; a.style.display='none'; document.body.appendChild(a); a.click(); setTimeout(function(){ try{window.location.href=home;}catch(_){}} ,40); }catch(_){} }

  window.lxwOpenWallet=function(net, homeTarget){
    net=(net==='xrp')?'xrpl':(NETS[net]?net:'stellar');
    home=homeTarget||null; current=net;
    if(!modal) build();
    modal.querySelector('.lxw-title').textContent='Connect Wallet';
    modal.querySelector('.lxw-sub').textContent=NETS[net].sub;
    modal.querySelector('.lxw-searchin').value='';
    renderList(net);try{window.__lxMarkLastUsed&&window.__lxMarkLastUsed();}catch(_){}
    showScreen('wallet');
    modal.removeAttribute('hidden');
    // re-trigger entrance animation
    var m=modal.querySelector('.lxw-modal'); m.style.animation='none'; void m.offsetWidth; m.style.animation='';
  };
})();
