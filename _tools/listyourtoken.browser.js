/* /list-your-token — the browser half.
 *
 * Kept in its own file rather than a template literal in the transform, deliberately: inside a
 * template literal an unrecognised escape collapses, so /\s+/g becomes /s+/g and quietly matches the
 * letter s (DEV landmine 8, and the bug that ate every "s" from the blog descriptions). Read as text
 * and injected verbatim, regexes here mean what they say.
 *
 * The wallet-signing functions are NOT written here. They are lifted out of _tools/_launchpad.js at
 * build time and spliced in at the LX_SIGNER marker, so Freighter / Albedo / Rabet / xBull / LOBSTR /
 * WalletConnect all keep exactly one implementation and a fix to one page fixes the other.
 *
 * THE ORDER OF THE PAYMENT AND THE APPLICATION IS THE WHOLE DESIGN. The payment goes first, because
 * the server will not store a request without one. That leaves a window where money has moved and the
 * application has not landed, so the hash is written to localStorage BEFORE it is sent, retried three
 * times, retried again on the next page load, and — if it still fails — shown to the user with what to
 * do about it. A paid request must never disappear quietly.
 */
(function () {
  'use strict';

  var FEE_ACCT = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
  var PASSPHRASE = 'Public Global Stellar Network ; September 2015';
  var HZ = 'https://horizon.stellar.org';
  var PENDING_KEY = 'lumos.listing.pending';
  var PENDING_MAX_AGE = 7 * 24 * 3600 * 1000;
  // The server decodes the base64 and caps the result at 512KB, so cap the FILE here — checking the
  // encoded length instead would reject files a third smaller than the real limit.
  var LOGO_MAX = 512 * 1024;

  // lxLpSignXdr reads the passphrase off this. The launchpad sets a fuller version of the same
  // object; this page only ever needs the two fields, and never overwrites one that already exists.
  if (!window.__lxLP) window.__lxLP = { passphrase: PASSPHRASE, horizon: HZ };

  /* LX_SIGNER */

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function show(el, yes) { if (el) { if (yes) el.removeAttribute('hidden'); else el.setAttribute('hidden', ''); } }

  // 1376.1321440 -> "1,376.13". The exact seven-decimal string is what gets signed; this is only ever
  // what a person reads.
  function human(n) {
    var x = Number(n);
    if (!isFinite(x)) return '—';
    return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function shortHash(h) { return String(h || '').slice(0, 10) + '…' + String(h || '').slice(-8); }

  var form = $('ltForm');
  if (!form) return;

  var elAmt = $('ltAmt'), elRate = $('ltRate'), elTo = $('ltTo');
  var elGo = $('ltGo'), elGoT = $('ltGoT'), elStatus = $('ltStatus'), elFormErr = $('ltFormErr');
  var elDone = $('ltDone'), elStranded = $('ltStranded');

  function status(t) { if (elStatus) elStatus.textContent = t || ''; }
  function formErr(t) {
    if (!elFormErr) return;
    elFormErr.textContent = t || '';
    show(elFormErr, !!t);
  }
  function fieldErr(id, t) {
    var e = $(id + 'Err'), i = $(id);
    if (e) { e.textContent = t || ''; show(e, !!t); }
    if (i) { if (t) i.classList.add('lt-wrong'); else i.classList.remove('lt-wrong'); }
  }
  function clearErrors() {
    formErr('');
    ['ltCode', 'ltIssuer', 'ltDescr', 'ltLogo', 'ltSite'].forEach(function (id) { fieldErr(id, ''); });
  }

  // ---------------------------------------------------------------- the quote
  var quote = null;

  function paintQuote() {
    if (!quote) return;
    var o = quote.options[0];
    if (elAmt) elAmt.textContent = human(o.amount) + ' XLM';
    if (elRate) elRate.textContent = '$' + quote.priceUsd + ' at $' + Number(quote.xlmUsd).toFixed(6) + ' / XLM';
    if (elTo) { elTo.textContent = FEE_ACCT; elTo.title = FEE_ACCT; }

    // The headline figure comes from the endpoint, not from the markup. The two used to be able to
    // disagree, and a page saying $250 beside a button charging something else is the one thing this
    // page cannot afford to do.
    var shown = '$' + quote.priceUsd;
    ['ltFee', 'ltFee2'].forEach(function (id) { var e = $(id); if (e) e.textContent = shown; });
    paintButton();
  }

  function loadQuote() {
    return fetch('/lxapi/listingquote', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.options || !d.options[0] || !(+d.options[0].amount > 0)) {
          throw new Error('We could not price the listing just now. Reload in a moment.');
        }
        quote = d;
        paintQuote();
        return d;
      });
  }

  // ---------------------------------------------------------------- wallet state
  function connectedAddr() {
    try {
      var a = localStorage.getItem('lumos.address') || '';
      return a.charAt(0) === 'G' ? a : '';
    } catch (e) { return ''; }
  }

  var busy = false;

  function paintButton() {
    if (!elGoT || !elGo) return;
    if (busy) return;
    var addr = connectedAddr();
    if (!addr) { elGoT.textContent = 'Connect wallet to pay'; elGo.disabled = false; return; }
    if (!quote) { elGoT.textContent = 'Pricing…'; elGo.disabled = true; return; }
    elGoT.textContent = 'Pay ' + human(quote.options[0].amount) + ' XLM and submit';
    elGo.disabled = false;
  }

  function setBusy(yes) {
    busy = yes;
    if (elGo) elGo.disabled = yes;
    if (yes && elGoT) elGoT.textContent = 'Working…';
    if (!yes) paintButton();
  }

  // The connect modal lives in the site shell and is opened with no home target, so it closes back
  // onto this page instead of navigating away mid-application.
  function openConnect() {
    if (typeof window.lxwOpenWallet === 'function') { window.lxwOpenWallet('stellar'); return true; }
    return false;
  }

  // The modal does not announce a connection, and the header's own connect button can fire at any
  // time, so the label is kept in step by watching the value it writes.
  var lastAddr = connectedAddr();
  setInterval(function () {
    var a = connectedAddr();
    if (a !== lastAddr) { lastAddr = a; paintButton(); }
  }, 500);

  // ---------------------------------------------------------------- the logo
  var logoData = '', logoName = '';
  var elDrop = $('ltDrop'), elDropIn = $('ltDropIn'), elFile = $('ltLogo');

  function paintLogo() {
    if (!elDropIn) return;
    if (!logoData) {
      elDropIn.className = 'lt-drop-in';
      elDropIn.innerHTML = '<span class="lt-drop-t">Choose a logo</span>'
        + '<span class="lt-drop-d">PNG, JPEG, WebP or GIF · square · up to 512KB</span>';
      return;
    }
    elDropIn.className = 'lt-picked';
    var img = document.createElement('img');
    img.src = logoData;
    img.alt = '';
    var txt = document.createElement('div');
    txt.innerHTML = '<div class="lt-picked-ok">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="20 6 9 17 4 12"></polyline></svg><span>Logo ready</span></div>'
      + '<div class="lt-picked-n"></div>';
    txt.querySelector('.lt-picked-n').textContent = (logoName ? logoName + ' · ' : '') + 'Click to change';
    elDropIn.innerHTML = '';
    elDropIn.appendChild(img);
    elDropIn.appendChild(txt);
  }

  var LOGO_OK = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'image/gif': 1 };

  function takeFile(file) {
    fieldErr('ltLogo', '');
    if (!file) return;
    if (!LOGO_OK[String(file.type).toLowerCase()]) {
      logoData = ''; logoName = ''; paintLogo();
      fieldErr('ltLogo', 'The logo must be a PNG, JPEG, WebP or GIF.');
      return;
    }
    if (file.size > LOGO_MAX) {
      logoData = ''; logoName = ''; paintLogo();
      fieldErr('ltLogo', 'That file is ' + Math.round(file.size / 1024) + 'KB, over the 512KB limit.');
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      logoData = String(fr.result || '');
      logoName = file.name || '';
      paintLogo();
    };
    fr.onerror = function () { fieldErr('ltLogo', 'That file could not be read.'); };
    fr.readAsDataURL(file);
  }

  on(elFile, 'change', function () { takeFile(elFile.files && elFile.files[0]); });
  // The input covers the whole zone, so a drop lands on it natively; this is only the hover state.
  ['dragenter', 'dragover'].forEach(function (ev) {
    on(elDrop, ev, function (e) { e.preventDefault(); elDrop.classList.add('lt-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    on(elDrop, ev, function () { elDrop.classList.remove('lt-over'); });
  });
  on(elDrop, 'keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && elFile) { e.preventDefault(); elFile.click(); }
  });

  // ---------------------------------------------------------------- the fields
  var elDescr = $('ltDescr'), elCount = $('ltCount');
  on(elDescr, 'input', function () {
    if (elCount) elCount.textContent = String(elDescr.value.length);
  });
  // Stellar asset codes are conventionally upper case, and the ledger treats case as significant, so
  // fold it here rather than let a lower-case entry fail the existence check.
  var elCode = $('ltCode');
  on(elCode, 'input', function () {
    var v = elCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (v !== elCode.value) elCode.value = v;
  });
  var elIssuer = $('ltIssuer');
  on(elIssuer, 'input', function () {
    var v = elIssuer.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 56);
    if (v !== elIssuer.value) elIssuer.value = v;
  });

  function val(id) { var e = $(id); return e ? (e.value || '').trim() : ''; }

  function readForm() {
    return {
      network: ($('ltNet') || {}).value || 'stellar',
      code: (elCode.value || '').trim(),
      issuer: (elIssuer.value || '').trim().toUpperCase(),
      descr: (elDescr.value || '').trim(),
      // Handles go up AS TYPED. The asset page already turns a bare handle, an @handle or a full URL
      // into the right link, so cleaning them here would be a second implementation of that, free to
      // disagree with the first.
      website: val('ltSite'),
      twitter: val('ltX'),
      telegram: val('ltTg'),
      discord: val('ltDs'),
      logo: logoData
    };
  }

  var CODE_RE = /^[A-Z0-9]{1,12}$/;
  var ISSUER_RE = /^G[A-Z2-7]{55}$/;

  function validate(f) {
    var ok = true;
    if (!CODE_RE.test(f.code)) {
      fieldErr('ltCode', 'Letters and numbers, up to twelve.'); ok = false;
    }
    if (!ISSUER_RE.test(f.issuer)) {
      fieldErr('ltIssuer', 'A Stellar account address: G, then 55 characters.'); ok = false;
    }
    if (f.descr.length < 20) {
      fieldErr('ltDescr', 'Say what the project is — at least a sentence.'); ok = false;
    }
    // Optional, but if given it has to look like somewhere you can go. A domain with no dot in it is
    // a typo, not a site, and it would reach review as an unclickable string.
    if (f.website && !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(f.website)) {
      fieldErr('ltSite', 'That does not look like a web address.'); ok = false;
    }
    if (!ok) formErr('Fix the fields marked above, then try again.');
    return ok;
  }

  // ---------------------------------------------------------------- Horizon
  // XMLHttpRequest, not fetch: some wallet extensions wrap window.fetch and throw while inspecting an
  // outgoing transaction. The launchpad hit this with xBull and takes the same route.
  function xhr(method, url, body) {
    return new Promise(function (resolve, reject) {
      var r = new XMLHttpRequest();
      r.open(method, url, true);
      if (body != null) r.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      r.timeout = 45000;
      r.onload = function () {
        var j = null;
        try { j = JSON.parse(r.responseText); } catch (e) { }
        resolve({ status: r.status, ok: r.status >= 200 && r.status < 300, json: j });
      };
      r.onerror = function () { reject(new Error('Network error contacting Stellar.')); };
      r.ontimeout = function () { reject(new Error('Stellar took too long to answer.')); };
      r.send(body == null ? null : body);
    });
  }

  function loadAccount(pk) {
    return xhr('GET', HZ + '/accounts/' + pk, null).then(function (r) {
      if (r.status === 404) {
        throw new Error('That account does not exist on Stellar mainnet yet. It needs a balance before it can pay.');
      }
      if (!r.ok || !r.json) throw new Error('Could not read your account from Stellar.');
      return r.json;
    });
  }

  function xlmBalance(acct) {
    var b = (acct.balances || []).filter(function (x) { return x.asset_type === 'native'; })[0];
    return b ? Number(b.balance) : 0;
  }

  // ---------------------------------------------------------------- the pending record
  function savePending(rec) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(rec));
    } catch (e) {
      // Almost always the logo pushing the record over the storage quota. The application matters
      // more than the image, so drop the image and keep the record.
      try {
        var lean = { f: Object.assign({}, rec.f, { logo: '' }), hash: rec.hash, paid: rec.paid, ts: rec.ts };
        localStorage.setItem(PENDING_KEY, JSON.stringify(lean));
      } catch (e2) { }
    }
  }
  function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch (e) { } }
  function readPending() {
    try {
      var raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !p.hash || !p.f) return null;
      if (Date.now() - (+p.ts || 0) > PENDING_MAX_AGE) { clearPending(); return null; }
      return p;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- the application
  function postApplication(f, hash) {
    return fetch('/lxapi/listing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        network: f.network, code: f.code, issuer: f.issuer,
        descr: f.descr, logo: f.logo || '', txHash: hash,
        website: f.website || '', twitter: f.twitter || '',
        telegram: f.telegram || '', discord: f.discord || ''
      })
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; });
    });
  }

  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  // Three attempts, widening. A 400 is the server's considered answer and is not retried; only a
  // transport failure or a 5xx is.
  function submitApplication(f, hash, attempt) {
    attempt = attempt || 1;
    return postApplication(f, hash).then(function (r) {
      if (r.d && r.d.ok) return r.d;
      if (r.status >= 400 && r.status < 500) {
        var e = new Error((r.d && r.d.error) || 'The application was refused.');
        e.final = true;
        throw e;
      }
      throw new Error((r.d && r.d.error) || 'Server error');
    }).catch(function (err) {
      if (err.final || attempt >= 3) throw err;
      return wait(attempt * 1500).then(function () { return submitApplication(f, hash, attempt + 1); });
    });
  }

  function showDone(f, paid, hash, id) {
    clearPending();
    show(form, false);
    show(elStranded, false);
    show(elDone, true);
    var set = function (i, v) { var e = $(i); if (e) { e.textContent = v; e.title = v; } };
    set('ltDoneAsset', f.code + ' · ' + f.issuer);
    set('ltDonePaid', paid ? human(paid) + ' XLM' : '—');
    set('ltDoneTx', hash);
    set('ltDoneId', id || '—');
    elDone.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function showStranded(hash) {
    show(elStranded, true);
    var e = $('ltStrandedTx');
    if (e) e.textContent = hash;
    elStranded.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- pay, then apply
  function run(f, addr) {
    var S, amount, hash;
    setBusy(true);
    clearErrors();
    status('Checking the price…');

    return loadQuote()
      .then(function () {
        amount = quote.options[0].amount;
        status('Reading your account…');
        return Promise.all([lxLpSdk(), loadAccount(addr)]);
      })
      .then(function (both) {
        S = both[0];
        var acct = both[1];
        // Caught here rather than by Horizon, so the message names the actual problem. The reserve is
        // not spendable, and a payment that empties the account to the last stroop fails anyway.
        if (xlmBalance(acct) < Number(amount) + 2) {
          throw new Error('Not enough XLM. This costs ' + human(amount)
            + ' XLM plus the network fee, and the account needs to keep its reserve.');
        }
        var tb = new S.TransactionBuilder(new S.Account(addr, acct.sequence), {
          fee: '3000', networkPassphrase: PASSPHRASE
        })
          .addOperation(S.Operation.payment({
            destination: FEE_ACCT, asset: S.Asset.native(), amount: amount
          }))
          .addMemo(S.Memo.text('LumosCore listing'))
          .setTimeout(180)
          .build();
        status('Waiting for your signature…');
        return lxLpSignXdr(tb.toXDR(), addr);
      })
      .then(function (signed) {
        status('Submitting the payment to Stellar…');
        return xhr('POST', HZ + '/transactions', 'tx=' + encodeURIComponent(signed));
      })
      .then(function (r) {
        var res = r.json || {};
        if (!res.successful) {
          var rc = res.extras && res.extras.result_codes;
          throw new Error('The payment did not go through: '
            + (rc ? JSON.stringify(rc) : (res.detail || ('HTTP ' + r.status))));
        }
        hash = res.hash;
        // Written BEFORE the application is sent. From this line on the money has moved, and the
        // hash is the only thing that can reunite it with the request.
        savePending({ f: f, hash: hash, paid: amount, ts: Date.now() });
        status('Payment confirmed. Recording your application…');
        return submitApplication(f, hash);
      })
      .then(function (d) {
        showDone(f, amount, hash, d.id);
      })
      .catch(function (err) {
        setBusy(false);
        if (hash) {
          // Paid, but not recorded. Never silent.
          status('');
          formErr('');
          showStranded(hash);
          return;
        }
        status('');
        formErr(err && err.message ? err.message : 'Something went wrong. Nothing was charged.');
      });
  }

  on(form, 'submit', function (e) {
    e.preventDefault();
    if (busy) return;
    clearErrors();
    var f = readForm();
    if (!validate(f)) return;
    var addr = connectedAddr();
    if (!addr) {
      status('Connect a Stellar wallet, then press pay again.');
      if (!openConnect()) formErr('The wallet chooser did not open. Use the Connect button in the header.');
      return;
    }
    run(f, addr);
  });

  // ---------------------------------------------------------------- recovery on load
  // A payment whose application never landed retries here, quietly, before the user does anything.
  function resume() {
    var p = readPending();
    if (!p) return;
    status('Finishing an earlier application…');
    submitApplication(p.f, p.hash).then(function (d) {
      showDone(p.f, p.paid, p.hash, d.id);
    }).catch(function (err) {
      status('');
      // The server has considered it and said no: the money is ours to refund by hand, and holding a
      // dead record locally would only retry forever.
      if (err && err.final) { clearPending(); formErr(err.message); return; }
      showStranded(p.hash);
    });
  }

  // ---------------------------------------------------------------- start
  paintLogo();
  paintButton();
  loadQuote().catch(function (err) {
    if (elAmt) elAmt.textContent = '—';
    if (elRate) elRate.textContent = 'unavailable';
    formErr(err && err.message ? err.message : 'We could not price the listing just now.');
  }).then(resume);
})();
