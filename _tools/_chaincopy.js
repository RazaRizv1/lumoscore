// Phase 1 of the Aptos residue: the shared-overlay COPY, fixed in the markup instead of at runtime.
//
// The site ships from the Aptos design container and corrects the chain's name in the browser. A human
// therefore sees "Stellar" everywhere and the served HTML still says "Aptos" -- 1,141 times across 94 of
// 97 pages. That was invisible until an assistant connected through LumosCore MCP read the markup and
// told RAZA the Pools page "displays conflicting Stellar and Aptos data". Machines read markup.
//
// WHY EXACT STRINGS AND NOT A SWEEP. Two reasons, both measured:
//   * Some Aptos strings are CORRECT. LumosCore is multi-chain and its chain tables name Aptos as
//     Aptos -- NAMES={stellar:'Stellar', ..., aptos:'Aptos', ...} is right. Roughly 42 occurrences are
//     like this. A /Aptos/g sweep would corrupt every one of them. The tell is the KEY on the left, not
//     the word on the right, which no simple regex can see.
//   * Much of what the runtime "corrects" is not a rename at all. Diffing the static markup against the
//     settled DOM on /docs/fees, "25,420.18 APT" becomes "0.00 XLM" -- that is a real balance arriving,
//     not a word being swapped. Baking the settled text would freeze one visitor's data into the page.
//
// So this does only the part that is unambiguously a rename: whole phrases from the two shared overlays
// that ship on nearly every page -- the Send/Receive modal and the search popup. Each string below was
// checked to exist ONLY in the container (no transform emits any of them, so nothing re-introduces them)
// and, where the node renders, to match what the runtime already puts there:
//
//     "Trustlines let you hold non-native assets on Aptos."  ->  runtime shows "... on Stellar."
//     "Assets on Aptos"                                      ->  runtime shows "Assets on Stellar"
//     "Aptos wallet"                                         ->  runtime shows "Stellar wallet"
//
// which makes this a no-op for every human and a fix for every machine.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// ORDER IS LOAD-BEARING: longest first. "Aptos wallet" -> "Stellar wallet" applied first would turn
// "Choose an Aptos wallet to continue" into "Choose an Stellar wallet", so the phrase that carries the
// article is rewritten whole, before the bare label is touched.
const SUBS = [
  ['Choose an Aptos wallet to continue', 'Choose a Stellar wallet to continue'],
  ['Only send APT and Aptos-based assets to this address', 'Only send XLM and Stellar-based assets to this address'],
  ['Trustlines let you hold non-native assets on Aptos', 'Trustlines let you hold non-native assets on Stellar'],
  ['Your Aptos address', 'Your Stellar address'],
  ['Assets on Aptos', 'Assets on Stellar'],
  ['Aptos wallet', 'Stellar wallet'],

  // THE CHAIN SLOT IN THE TRADE HERO (RAZA 2026-10-08, approving the fix). `<h1>Explore the
  // <em>Aptos</em> DEX</h1>` — the inner element is the slot the runtime re-skin rewrites to the
  // connected chain, so a human has always read "Explore the Stellar DEX" and every crawler has read
  // Aptos. That is this transform's whole remit: the rename is unambiguous, and after it the runtime
  // rewrites Stellar to Stellar, a no-op.
  //
  // MATCHED WITH THE TAGS, not on the bare word, which is the discipline the header above sets out —
  // roughly 42 Aptos strings in these containers are CORRECT and a /Aptos/g sweep would corrupt every
  // one. Measured before adding: these three markup-exact forms occur 3 times in total, all of them
  // the Trade hero (desktop, dark, mobile). Mobile spells the same slot with a span.
  ['<em>Aptos</em>', '<em>Stellar</em>'],
  ['<span class="hl">Aptos</span>', '<span class="hl">Stellar</span>'],

  // ---- PHASE 2: the chain's name in the copy, verified hit by hit ------------------------------
  //
  // RAZA 2026-10-08, with the count from his own audit: 96 of 97 built pages carry "Aptos"
  // somewhere, and a crawler reads the served markup, not what the runtime re-skin puts there.
  // The inventory behind this batch: 415 occurrences, 73 distinct visible phrases, 10 attributes.
  //
  // EVERY PAIR BELOW WAS COUNTED IN THE CONTAINERS BEFORE IT WAS WRITTEN -- 30 pairs, 144
  // occurrences, no rule matching zero. A pair that matches nothing is a silent no-op that reads
  // like a fix, which is the failure this file's header already warns about.
  //
  // WHAT IS DELIBERATELY NOT HERE, because a rename would make it wrong rather than right:
  //   * sample DATA -- "Aptos Coin", "$APT", "CELL / APT", "Aptos - 1.48% of supply". These are the
  //     design's mock rows, replaced at runtime by the real asset. Renaming the chain inside a made
  //     up holding does not make the holding true, it just hides that it is mock.
  //   * "Aptos DEX charges roughly 0.0001 APT per operation" and "trades natively on the Aptos
  //     Decentralized Exchange against APT" -- both carry a FIGURE and a pair. Swapping the chain
  //     name alone leaves a Stellar sentence quoting an Aptos fee; changing the number too is a
  //     factual edit, not a copy pass.
  //   * "Powered by Aptos Wallet Standard" and the per-network label map beside it -- Stellar has no
  //     "Wallet Standard" to name, so the right text is a product decision, not a substitution.
  //   * the two search-popup chain pills -- their label disagrees with their own data-chain, which
  //     is a component bug rather than a word.
  ['Discover early gems on Aptos.', 'Discover early gems on Stellar.'],
  ['How the Aptos DEX works', 'How the Stellar DEX works'],
  ['Trade any Aptos-issued asset', 'Trade any Stellar-issued asset'],
  ['Initialize a new liquidity pool on Aptos AMM', 'Initialize a new liquidity pool on Stellar AMM'],
  ['Initialize a new pool on Aptos AMM', 'Initialize a new pool on Stellar AMM'],
  ["Pools run on Aptos's native AMM.", "Pools run on Stellar's native AMM."],
  ["Discover, trade, and launch tokens on Aptos's decentralized exchange.", "Discover, trade, and launch tokens on Stellar's decentralized exchange."],
  ['DEX on Aptos.', 'DEX on Stellar.'],
  ['Every trade settles peer-to-peer on Aptos.', 'Every trade settles peer-to-peer on Stellar.'],
  ['Launch tokens on the Aptos DEX.', 'Launch tokens on the Stellar DEX.'],
  ['Trade pairs on Aptos DEX.', 'Trade pairs on Stellar DEX.'],
  ['Launch tokens directly on the Aptos DEX.', 'Launch tokens directly on the Stellar DEX.'],
  ['Your token is now live on the Aptos network', 'Your token is now live on the Stellar network'],
  ['Once your token is minted on the Aptos network', 'Once your token is minted on the Stellar network'],
  ['Asset issued on Aptos', 'Asset issued on Stellar'],
  ['New Mints on Aptos', 'New Mints on Stellar'],
  ['Create another token on Aptos', 'Create another token on Stellar'],
  ['Native utility token \u00b7 live on Aptos', 'Native utility token \u00b7 live on Stellar'],
  ['Aptos distributions are anchored to this same contract.', 'Stellar distributions are anchored to this same contract.'],
  ["Choose the chains you're bridging between (Aptos and your destination network)", "Choose the chains you're bridging between (Stellar and your destination network)"],
  ['Aptos automatically finds the cheapest route', 'Stellar automatically finds the cheapest route'],
  ['digital representation of the US Dollar on the Aptos Decentralized Exchange.', 'digital representation of the US Dollar on the Stellar Decentralized Exchange.'],
  // Covers the bare text and the aria-label/data-tooltip that wrap it -- we link stellar.expert.
  ['View on Aptos Explorer', 'View on Stellar Explorer'],
  ['aria-label="Aptos AMM"', 'aria-label="Stellar AMM"'],
  ['aria-label="Aptos DEX"', 'aria-label="Stellar DEX"'],
  ['title="One-time Aptos asset issuance fee"', 'title="One-time Stellar asset issuance fee"'],
  // Labels that contradict the class sitting on the very same element.
  ['<span class="chain-pill stellar">Aptos</span>', '<span class="chain-pill stellar">Stellar</span>'],
  ['<span class="chain-pill xrpl">Aptos</span>', '<span class="chain-pill xrpl">XRP Ledger</span>'],
  ['<span class="dot stellar"></span>Aptos', '<span class="dot stellar"></span>Stellar'],
  ['Connected \u00b7 Aptos', 'Connected \u00b7 Stellar'],

  // ---- the search popup's chain filters, whose labels contradict their own data-chain ----------
  //
  // Two pills, on 88 and 85 pages, together about half of everything still saying "Aptos". The
  // first is data-chain="xrpl" labelled Aptos; the second is data-chain="stellar", also labelled
  // Aptos. The wiring is right -- the live layer filters by the id -- only the roster is wrong,
  // which is the same shape as the sign-in chooser.
  //
  // ANCHORED ON WHAT IS ADJACENT, NOT ON THE BUTTON. Each pill opens thousands of characters
  // earlier because its icon is an inline base64 image, so "the Aptos inside an sp-filter-pill" is
  // not expressible as a plain string. Verified instead by walking back 12,000 characters from
  // every match: 88/88 for the xrpl pill, 51/51 desktop and 40/40 for the stellar one. An earlier
  // candidate anchor was dropped for failing exactly this -- 3 of its matches were in an lt-panel.
  ['<span class="ch-ico xrpl">X</span> Aptos', '<span class="ch-ico xrpl">X</span> XRP Ledger'],
  ['</span></span> Aptos <span style="opacity:0.7;font-weight:600">(',
    '</span></span> Stellar <span style="opacity:0.7;font-weight:600">('],
  ['</span></span> Aptos' + String.fromCharCode(10) + '          </button>',
    '</span></span> Stellar' + String.fromCharCode(10) + '          </button>'],

  // ---- the chain's name inside the design's sample rows -----------------------------------------
  //
  // RAZA 2026-10-08: "why dont you remove the mock rows outright... if it can be done without
  // breaking anything". It cannot, for the rows that matter, and that is measured rather than
  // argued. _lumostoken.js fills Top Holders by CLONING the design's rows as templates:
  //
  //     var hr=qa(".holder-row"), top=hold.filter(...).slice(0, hr.length);
  //     hr.forEach(function(row,i){ var c=row.cloneNode(true); ... replaceChild ... })
  //
  // "slice(0, hr.length)" means the number of REAL holders the page can show is bounded by the
  // number of MOCK rows in the markup. Delete them and Top Holders renders nothing. The same
  // fill-in-place shape is why this codebase marks claimed nodes .lxp at all.
  //
  // So the nodes stay and only the chain word changes -- which is the whole machine-readable point,
  // since none of this is ever visible: sampled 150 times over 9s from first paint on /pools, and
  // checked at settle on /lumos, /rewards, /dashboard and both launchpad steps -- zero visible.
  // The renderer drops the "Aptos " prefix entirely at runtime (it removes the .b-ico and rewrites
  // the text node), so this edit is invisible to a reader and only ever read by a crawler.
  ['Aptos ' + '·' + ' ', 'Stellar ' + '·' + ' '],
  ['Aptos AMM utility', 'Stellar AMM utility'],
  ['fee tier ' + '·' + ' Aptos AMM', 'fee tier ' + '·' + ' Stellar AMM'],
  ['Aptos price', 'Stellar price'],

  // ---- the two sentences that carry a figure (RAZA 2026-10-08, "fix the fee sentence and the
  //      USDC one") -------------------------------------------------------------------------------
  //
  // Held back from the earlier passes on purpose: swapping only the chain name would have left a
  // Stellar sentence quoting an Aptos fee and an Aptos trading pair, which is worse than the
  // original because it reads as deliberate.
  //
  // THE FEE. Stellar's base fee is 100 stroops per operation = 0.00001 XLM, one order of magnitude
  // below the Aptos figure the template carried, so the number moves with the ticker. "roughly"
  // stays honest: 100 stroops is the floor, and surge pricing raises it when a ledger is full.
  //
  // THE PAIR. Circle's USDC on Stellar trades against XLM on the SDEX, so both the venue and the
  // counter-asset change in the same sentence.
  ['Aptos DEX charges roughly 0.0001 APT per operation', 'Stellar DEX charges roughly 0.00001 XLM per operation'],
  ['trades natively on the Aptos Decentralized Exchange against APT.', 'trades natively on the Stellar Decentralized Exchange against XLM.'],

  // ---- "no protocol fees" needed a subject (RAZA 2026-10-08) ------------------------------------
  //
  // The sentence was true of the Stellar DEX and misleading on LumosCore. It sat a few hundred
  // pixels from a swap panel reading "Trading fee 0.2%", so a reader could take "there are no
  // protocol fees" to mean this site charges nothing and then watch 0.2% come off the quote.
  //
  // Naming the subject fixes it without weakening the true part: the EXCHANGE takes nothing, and
  // our fee is stated plainly beside it.
  //
  // THE FIGURES ARE READ OUT OF _feerate.js, NOT FROM MEMORY: window.__lxFeeRate is 0.002, dropping
  // to 0.001 while the account holds THRESH=250000 LUMOS from the canonical mainnet issuer. The
  // limit-order case is deliberately not mentioned -- feeRate() appears zero times in
  // _dexassetdata.js, so what the limit pane charges is not something this sentence should assert.
  ["There are no protocol fees or maker/taker rebates — everyone trades at the same rate.",
    "The exchange itself takes no protocol fee and offers no maker/taker rebates — everyone trades at the same rate. LumosCore's own trading fee is 0.2%, or 0.1% while you hold 250,000 LUMOS, and is shown on every quote. Limit orders are free."],

  // ---- limit orders are free (RAZA 2026-10-08, confirming what the code would not tell me) ------
  //
  // Left out of the fee sentence when it was written, because feeRate() appears zero times in
  // _dexassetdata.js and a fee claim is not something to assert from memory. Confirmed by RAZA, so
  // it goes in.
  //
  // THE ANCHOR CARRIES ITS OWN CLOSING TAG, and that is what makes this safe to re-run. The pair
  // above already rewrote this sentence in the containers, so a corrective rule has to match the
  // NEW text -- and a replacement that contains its own search string appends on every build, which
  // is a landmine this repo has hit before. Matching "quote.</span>" instead of "quote." means that
  // after the edit the tag follows "free." and the search finds nothing on the next run.
  ['shown on every quote.</span>', 'shown on every quote. Limit orders are free.</span>'],

  // ---- the wallet-standard credit, replaced rather than renamed (RAZA 2026-10-08) ---------------
  //
  // There is no substitution here: Stellar has no "Wallet Standard" to name, so renaming the chain
  // would have invented a specification. The line's job is to say what is behind the wallet list,
  // so it now names the wallets that actually are.
  //
  // THE DEAD LINK GOES WITH IT. The credit was wrapped in <a href="#">, which goes nowhere -- a
  // link to a standard we do not implement, pointing at nothing. The names are plain text now.
  //
  // The per-network map loses its hedera key as well. That chain was dropped from the chooser in
  // _signinnets.js, so the entry could only ever have been dead; and the xrpl value read
  // "Xaman · Aptos", which named one real wallet and one wrong chain.
  ["<span class=\"lc-mfoot-attr\">Powered by <a href=\"#\">Aptos Wallet Standard</a></span>",
    "<span class=\"lc-mfoot-attr\">Powered by Freighter, Albedo, xBull and Rabet</span>"],
  ["var L={hedera:\"Aptos Wallet Standard\",stellar:\"Aptos Wallet Standard\",xrpl:\"Xaman · Aptos\"};",
    "var L={stellar:\"Freighter, Albedo, xBull and Rabet\",xrpl:\"Xaman, GemWallet and Crossmark\"};"],
  // The connected-account chip's network name, baked as the design's base chain. The live layer
  // rewrites it, so this is markup correctness only -- the same reason as everything above it.
  ['<span id="lcNetNameDone">Aptos</span>', '<span id="lcNetNameDone">Stellar</span>'],

  // ---- the tail (RAZA 2026-10-08: "keep going on the tail") -------------------------------------
  //
  // Prose on /trade, and five places where the CONNECTED chain is named. Each checked in context
  // first, because this is where the correct Aptos strings live and a careless pass does real harm.
  //
  // ONE CANDIDATE WAS DROPPED FOR EXACTLY THAT: data-l="Aptos" on the landing page is a label on
  // the network MARQUEE, sitting between data-l="Hedera" and its own /assets/networks/aptos.png.
  // That one names Aptos because Aptos is what it is, and renaming it would have put "Stellar"
  // under the Aptos logo -- the failure this file's header exists to prevent.
  ['place limit orders against the on-chain Aptos DEX orderbook',
    'place limit orders against the on-chain Stellar DEX orderbook'],
  ['Issue an asset on Aptos and list it on Aptos DEX in minutes',
    'Issue an asset on Stellar and list it on Stellar DEX in minutes'],
  // The connected-network chips: /dashboard's "Network: Aptos" status pill, the bridge's own chip
  // reading "Aptos / Connected", and the bridge send-network row. All name the chain in use.
  ['<span class="val">Aptos', '<span class="val">Stellar'],
  ['<span class="nm">Aptos', '<span class="nm">Stellar'],
  ['<div class="s" data-rv="sendnet">Aptos', '<div class="s" data-rv="sendnet">Stellar'],
  // A legend item carrying an xrpl dot and an Aptos label -- the class is the honest half.
  ['<span class="dot xrpl"></span>Aptos', '<span class="dot xrpl"></span>XRP Ledger'],
  // An HTML comment, invisible to a reader and read by anything parsing the document.
  ['<!-- Aptos ' + '—' + ' Trading Activity -->', '<!-- Stellar ' + '—' + ' Trading Activity -->'],

  // ---- the LUMOS page's chain column, and the rewards chip ---------------------------------------
  //
  // Labels sitting beside a logo, on lumoscore-lumos-token and lumoscore-rewards. Every one of them
  // is next to the SAME image -- the base64 ending CwCQAAA=, which is the Stellar mark the filter
  // pills and the connected-chain chips also use -- so the picture was right and only the word was
  // wrong. Checked rather than assumed: all 22 occurrences of the table anchor share that one image
  // signature, so none of them is another chain's row.
  //
  // The sibling rows that DO name other chains were handled separately and correctly: the xrpl
  // chain-pill and the xrpl legend dot both say XRP Ledger now.
  ['alt=""></span></span> Aptos</div>', 'alt=""></span></span> Stellar</div>'],
  ['alt=""></span> Aptos</span></td>', 'alt=""></span> Stellar</span></td>'],
  ['/></svg> Aptos</span></td>', '/></svg> Stellar</span></td>'],
  ['alt=""></span>Aptos', 'alt=""></span>Stellar'],

  // ---- the last of the tail -----------------------------------------------------------------
  //
  // One more chain label beside the Stellar mark, this one on the phone's LUMOS page, where the
  // indentation differs from its desktop twin -- which is why the desktop anchor missed it.
  ["alt=\"\"></span>\n            </span>\n            Aptos",
    "alt=\"\"></span>\n            </span>\n            Stellar"],

  // THE REWARDS EXAMPLES DO NOT TRANSLATE ONE FOR ONE. The sentence offered two Aptos pools:
  // "a LUMOS / NATIVE pool — LUMOS/APT on Aptos or LUMOS/aBTC on Aptos — to earn a share".
  // Stellar's native asset is XLM, so the first example becomes LUMOS/XLM; the second named aBTC,
  // an Aptos-wrapped BTC with no Stellar counterpart I can point at, so it is dropped rather than
  // replaced with a pool I would be inventing. The surviving example is one this site actually
  // promotes, and the sentence still reads as an example rather than a list.
  ["LUMOS/APT</b> on Aptos or <b>LUMOS/aBTC</b> on Aptos",
    "LUMOS/XLM</b> on Stellar"],

  // ---- the launchpad's placeholder token -------------------------------------------------------
  //
  // The review and confirmation screens ship an example token called "Aptos Coin ($APT)". It is a
  // PLACEHOLDER -- _launchpad.js overwrites every one of these with the name the user typed, via
  // txt(document.querySelector(".result-name"), r.name||CODE) and hn.textContent=d.name -- so the
  // words only ever reach a crawler.
  //
  // RENAMED, NOT RE-CHAINED. "Stellar Coin" would invent a token; the honest replacement for a
  // placeholder is a placeholder, so it says what it is. This is the last thing on these pages
  // still naming the wrong chain.
  ['<h2 class="result-name">Aptos Coin', '<h2 class="result-name">Your Token'],
  ['<div class="v">Aptos Coin', '<div class="v">Your Token'],
  ['<h2 class="hero-name">Aptos Coin', '<h2 class="hero-name">Your Token'],
  ['<div class="hero-name">Aptos Coin', '<div class="hero-name">Your Token'],
  ['View Aptos Coin ($APT) Token Page', 'View Your Token ($TOKEN) Token Page'],

  // The desktop LUMOS page indents this one further again, so neither earlier anchor reached it.
  ["alt=\"\"></span>\n                  </span>\n                  Aptos",
    "alt=\"\"></span>\n                  </span>\n                  Stellar"],

  // ---- PHASE 3: the figures that are nobody's (RAZA 2026-10-27, "use em-dash placeholders and fix
  //      the Wormhole copy") ---------------------------------------------------------------------
  //
  // THIS IS THE ONE EXCLUSION THE HEADER ABOVE MAKES THAT HAS NOW BEEN LIFTED, so read that note
  // first: it refused to touch "25,420.18 APT" because the runtime turns it into a real balance, and
  // "baking the settled text would freeze one visitor's data into the page". That reasoning is right
  // about baking a VALUE and silent about baking a PLACEHOLDER. An em dash is nobody's data, so it
  // cannot freeze anyone's, and it is what the rest of this codebase already shows for a balance it
  // does not know -- _dexassetdata.js writes "Balance: --" on a null, and _ammdata.js hides the
  // Deposit/Withdraw balance line until the real one lands, calling the baked figure "a number
  // belonging to nobody, beside a MAX button that would have used it".
  //
  // WHY IT WAS NOT MERELY COSMETIC. fixBalances() in _walletdata.js opened with
  // "if(window.__lxNative==null)return", so one value meant both "not loaded yet" and "could not be
  // read", and in both cases this baked line stayed. Verified on production with the Send dialog
  // actually OPEN -- not from the markup, and not from a closed modal, whose innerText silently falls
  // back to textContent and reports hidden nodes as visible:
  //
  //     Send   AMOUNT  XLM  Max   Balance: 25,420.18 XLM   RECIPIENT ADDRESS ...
  //
  // Max was never wrong (it reads window.__lxMaxXLM, and with no balance known it fills 0); only the
  // line lied. Receive and Swap were checked the same way and are CLEAN -- Swap shows a real
  // "Balance: 0 XLM" and its stale rate block is already display:none'd by its own layer -- so
  // neither is touched here.
  //
  // THE MATCHING FIX LANDS IN THE SAME CHANGE, and this pair is unsafe without it: fixBalances
  // recognised the row by /Balance:\s*[\d.,]+\s*XLM/, which an em dash does not satisfy, so on its
  // own this edit would have stopped the REAL balance ever being written. That function now accepts
  // the dash and writes one when the balance is unknown.
  //
  // Counted in the containers first, as everything in this file is: 63 desktop + 26 mobile.
  ['Balance: 25,420.18 APT', 'Balance: —'],
  // 30 desktop, 0 mobile -- the phone build has no second LP field. Deliberate, not a missed anchor.
  ['Balance: 4,200.00 USDC', 'Balance: —'],

  // THE RECEIVE ADDRESS, which is the worst-shaped of these: the element shows a Stellar G-address
  // and its data-copy carries a DIFFERENT fabricated address, an Aptos 0x one, so the screen and the
  // clipboard disagreed and both were invented. 30 desktop + 25 mobile.
  //
  // NOT user-reachable, which is why this is a markup pair and not a layer fix: on /wallet, where
  // Receive can actually be opened, the real layer has already replaced the whole element -- verified
  // by opening it, which showed the connected address in both the text and data-copy. Everywhere else
  // the overlay is an orphan with no trigger, so this text was only ever read by a crawler or an
  // assistant reading markup. That is exactly this file's remit.
  //
  // The data-copy attributes are left for a separate pass: there are five distinct fabricated values
  // and blanking an attribute is a behaviour change, not a copy one.
  ['>GA7K5N4M2X9P3R8Q1L6T2V8W4Y7Z3A5B8C2D6E1F4G7H9J2K5N4M2</div>', '>—</div>'],

  // THE BRIDGE PROVIDERS. 2 occurrences each, desktop only, both inside the "How the bridge works"
  // modal -- which is why no earlier sweep saw them: the modal is display:none until opened, and on
  // the /bridge HUB it is an orphan that extract_site.js now drops outright. What is left is the
  // Stellar bridge page, so these name Stellar's three real routes.
  //
  // Wormhole is not one of them. It is a correct entry in _bridge.js's provider table for the aptos
  // and worldchain site folders, so the word itself is not wrong everywhere -- only in this sentence,
  // on this chain, which is the same "the key on the left, not the word on the right" discipline the
  // header sets out.
  ['Cross-chain transfers via Wormhole and LayerZero.',
    'Cross-chain transfers via Circle CCTP, LayerZero and NEAR Intents.'],
  ['Transfers route through Wormhole and LayerZero, so you receive the destination asset directly.',
    'Transfers route through Circle CCTP, LayerZero or NEAR Intents, so you receive the destination asset directly.'],

  // ---- PHASE 4: the Create Pool trading fee (RAZA 2026-10-27, "fix the 0.5% pool fee") ----------
  //
  // THE ROW IS ALREADY HIDDEN, which is the whole reason this belongs here and not in a layer.
  // hideCpFee() in _ammdata.js sets display:none on it, for a reason that file states twice: every
  // Stellar AMM pool charges 0.3%, fixed by the protocol, so a line stating it on a form whose job is
  // the decisions you ARE making looks like a setting and is not one. Verified by OPENING the dialog
  // on production: the summary reads "Initial pool price —" and "Network fee ~0.00001 XLM", nothing
  // between them. No human sees 0.5%.
  //
  // What still said 0.5% was the MARKUP, 5 desktop + 3 mobile (home, amm light+dark, lumos-token
  // light+dark, and the three phone pages), and that is this file's entire remit -- the header's
  // "a no-op for every human and a fix for every machine". A JS gate cannot fix what the bytes say.
  //
  // 0.3% AND NOT A REMOVAL. Deleting the row would also make the bytes honest, but it would leave
  // hideCpFee() with nothing to match, so the day the markup changes shape there is no second line of
  // defence. Correcting the number keeps both: the row is right if it is ever read, and still hidden.
  // The hide matches /^trading fee/i on the row's text, so "Trading fee0.3%" still trips it.
  //
  // XRPL carries the identical row and gets the identical treatment in _xrplcopy2.js -- at 0.2%,
  // because there the fee is not protocol-fixed: createpool.js submits TradingFee 200 and writes the
  // same figure into the row at runtime. Same bug, different true value, so the pair cannot be shared.
  ['<div class="row"><span>Trading fee</span><strong>0.5%</strong></div>',
    '<div class="row"><span>Trading fee</span><strong>0.3%</strong></div>'],

  // THE SAME WRONG FIGURE, in the OTHER place it appears -- the pool page's Deposit / Withdraw
  // summary, 2 desktop + 1 mobile (amm-pool light, amm-pool dark, amm-pool mobile). _ammdata.js
  // already knows about both ("#16: the same row, in the other place it appears") and hides this one
  // too, via hidePoolFeeRow(), which is why it survived every sweep that looked at the rendered page.
  //
  // A DIFFERENT CLASS AND A DIFFERENT LABEL, so the pair above does not reach it: `.r` not `.row`,
  // and "Trading fee tier" not "Trading fee". Found only by grepping the BUILT bytes for the value
  // alone after the pair above was applied -- the lesson this file keeps relearning.
  ['<div class="r"><span>Trading fee tier</span><strong>0.5%</strong></div>',
    '<div class="r"><span>Trading fee tier</span><strong>0.3%</strong></div>'],

  // ---- PHASE 5: the promo carousel's "Low fees" slide (RAZA 2026-10-27, "fix the promo slide copy
  //      too") --------------------------------------------------------------------------------
  //
  // WHAT IT IS. The design ships a 4-slide promo carousel on the PHONE Trade page. Slide 3 invents a
  // pricing model LumosCore does not have: a free "sign up" that unlocks a member rate, a 0.8% guest
  // rate for everyone else, and 0.5% as the headline. There is no account on this site -- slide 4 of
  // the same carousel says so ("your wallet, your rules") -- and the real schedule is 0.2%, or 0.1%
  // holding 250,000 LUMOS, which _dexdata.js already states in the How-it-works modal.
  //
  // NOBODY SEES IT. inject_livemarket.js replaces this banner with the Living Market hero, so the
  // whole `.lumos-promo` block computes to display:none on production -- checked on the live phone
  // page, every slide 0x0. That is what makes it this file's problem and not a layer's: the invented
  // fee schedule is only ever read by a crawler, an LLM, or anyone viewing source.
  //
  // ONE SLIDE, ONE PAGE, ONE CONTAINER. Counted: 1 occurrence each, on lumoscore-dex-mobile.html, in
  // the MOBILE container only. The desktop Trade page and the Pools carousel have no fee slide --
  // the Pools one reads "Provide liquidity / Boosted pools / Launch a pool / Sub-second swaps" and
  // claims no percentage at all. XRPL carries the identical slide and gets the identical copy.
  //
  // TEXT ONLY. The CTA keeps href="#" -- a dead link on a hidden element, and the same attributes
  // exclusion the Receive-address note above sets out.
  ['Pay just <span class="lumos-promo-hi">0.5%</span> per trade.',
    'Pay just <span class="lumos-promo-hi">0.2%</span> per trade.'],
  ['Sign up free for the LumosCore rate. Guests pay 0.8% — every other trader keeps more of every fill.',
    '0.1% if you hold 250,000 LUMOS. No sign-up and no account — your wallet is all you need.'],
  ['<a href="#" class="lumos-promo-cta">Sign Up Free',
    '<a href="#" class="lumos-promo-cta">Start Trading'],

  // SLIDE 2 OF THE SAME CAROUSEL (RAZA 2026-10-27, "yes fix that too"), which promised
  // "fair-launch mechanics, transparent vesting, and on-chain verification from day one".
  //
  // Two of those three are things the Launchpad does not do, and our own docs say so:
  //   * VESTING does not exist. No transform in either fork mentions it; /docs/launch-a-token
  //     describes the opposite -- "Supply is fixed at issuance ... minted to your account in the
  //     issuing transaction".
  //   * VERIFICATION is explicitly refused. That page has a section headed "What it does not get
  //     you": "Issuing through LumosCore does not give your asset a verification mark. Our own
  //     domain cannot vouch for an asset." A promo claiming it from day one contradicts the
  //     documentation on the same site.
  //   * "CURATED" is the third: the Launchpad is open to anyone for $25. Curation is a separate,
  //     paid listing process with its own page.
  //
  // The replacement says only what the docs say: fixed supply, a pool opened in the same flow, and
  // the asset page every launch gets ("showing its price, pool and activity").
  ['Curated launches with fair-launch mechanics, transparent vesting, and on-chain verification from day one.',
    'Every launch has a fixed supply, a live pool from day one, and its own page here with price, pool and activity.'],

  // ---- PHASE 6: the network-fee unit (RAZA 2026-10-27, "now fix the ~0.00001 APT in the markup")
  //
  // 157 occurrences, 102 desktop + 55 mobile, across 66 built pages -- the largest single piece of
  // Aptos left in the markup, and the plainest: the FIGURE is right and only the ASSET is wrong.
  // Stellar's base fee is 100 stroops per operation = 0.00001 XLM, which the prose pair 200 lines up
  // already states and which _ammdata.js, _dexassetdata.js and _swapcalc.js all write at runtime.
  //
  // ONE PAIR FOR FIVE SHAPES. They differ by wrapper -- an inline-styled JetBrains Mono <strong> (144,
  // the Send/Swap overlays), `.row`/`.r` summary rows (11), and a `<span class="mono">` with no
  // leading "~" (2) -- so matching the VALUE instead of any wrapper covers all of them, including the
  // two the tilde-anchored form would have missed. The sibling fork learned that the hard way: XRPL's
  // `['~0.00001 APT', '~0.00001 XRP']` left exactly those 2 behind.
  //
  // SAFE AS A BARE STRING, checked both ways this file requires:
  //   * no Stellar transform EMITS it -- every one of them writes XLM -- so nothing re-introduces it;
  //   * every one of the 157 is in MARKUP, none inside a <script>. (On XRPL 10 of its leftovers are
  //     inside layer COMMENTS quoting this very bug, which is why that fork cannot use a bare pair.)
  ['0.00001 APT', '0.00001 XLM'],
];

const problems = [];
const staged = [];

for (const file of FILES) {
  if (!fs.existsSync(file)) { problems.push(file + ': missing'); continue; }
  const data = read(file);
  const { json, s, e } = getContents(data);
  const counts = {};
  let touched = 0, done = 0, keys = 0;

  for (const key of Object.keys(json)) {
    let html = String(json[key] || '');
    if (!html) continue;
    const before = html;
    for (const [from, to] of SUBS) {
      const n = html.split(from).length - 1;
      if (!n) continue;
      counts[from] = (counts[from] || 0) + n;
      touched += n;
      html = html.split(from).join(to);
    }
    if (html !== before) { json[key] = html; keys++; }
    // idempotence: a finished container holds the replacements and none of the searches
    for (const [, to] of SUBS) if (html.indexOf(to) >= 0) { done++; break; }
  }

  // THE ARTICLE CHECK. If any phrasing this list does not know about left an "an" stranded in front of
  // Stellar, the copy is now wrong in a way a reader would notice, and that is worse than leaving the
  // markup alone. Abort rather than ship it.
  for (const key of Object.keys(json)) {
    const v = String(json[key] || '');
    if (/\ban Stellar\b/.test(v)) problems.push(key + ': left "an Stellar" — a phrasing this list does not cover');
  }

  if (!touched && !done) { problems.push(file + ': none of the overlay copy found'); continue; }
  staged.push({ file, data, s, e, json, touched, keys, counts });
}

if (problems.length) {
  console.error('chain copy: ABORT — nothing written.');
  problems.slice(0, 12).forEach((x) => console.error('  ' + x));
  process.exit(1);
}

for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': ' + st.touched + ' replacement(s) across ' + st.keys + ' page(s)'
    + (st.touched ? '' : ' — already done'));
  for (const [from] of SUBS) if (st.counts[from]) console.log('      ' + String(st.counts[from]).padStart(4) + '  ' + JSON.stringify(from.slice(0, 52)));
}
console.log('chain copy: done');
