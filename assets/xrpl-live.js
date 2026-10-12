/*
 * HCN live XRP Ledger feed: READ-ONLY.
 * Plain browser WebSocket to public XRPL servers. No wallets, no secrets, no signing.
 * Only two commands are ever sent: "server_info" and "subscribe" to the public "ledger" stream.
 */
(function () {
  'use strict';
  var DEFAULT_SERVERS = ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com'];
  var RIPPLE_EPOCH = 946684800; // seconds between 1970-01-01 and 2000-01-01
  var CONNECT_TIMEOUT_MS = 8000;

  var servers = DEFAULT_SERVERS.slice();
  var serverIdx = 0;
  var ws = null;
  var nextId = 1;
  var retryDelay = 2000;
  var connectTimer = null;
  var history = []; // recent {index, txns}
  var cfgAttr = document.currentScript && document.currentScript.getAttribute('data-config');

  function $(id) { return document.getElementById(id); }
  function set(id, text) { var el = $(id); if (el) el.textContent = text; }
  function setAll(sel, text) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }
  function drops(d) {
    var n = Number(d);
    if (!isFinite(n)) return '-';
    var xrp = n / 1e6;
    return n.toLocaleString() + ' drops (' + xrp.toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' XRP)';
  }
  function xrpOnly(d) {
    var n = Number(d);
    return isFinite(n) ? (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' XRP' : '-';
  }
  function closeTime(rippleSecs) {
    var d = new Date((Number(rippleSecs) + RIPPLE_EPOCH) * 1000);
    var local = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
    return local;
  }
  function status(state, text) {
    var badge = $('xrpl-status');
    if (badge) {
      badge.textContent = state;
      badge.className = 'status-badge ' + (state === 'LIVE' ? 'status-alive' : 'status-waiting');
    }
    set('xrpl-status-text', text);
    window.HCN_XRPL_STATE = { state: state, text: text, server: servers[serverIdx] };
  }

  function send(obj) {
    if (ws && ws.readyState === 1) { obj.id = nextId++; ws.send(JSON.stringify(obj)); }
  }

  function showLedger(l) {
    if (l.ledger_index != null) {
      var idx = Number(l.ledger_index).toLocaleString();
      set('xrpl-ledger-index', idx);
      setAll('[data-xrpl="ledger-index"]', 'Ledger ' + idx);
    }
    if (l.ledger_time != null) set('xrpl-close-time', closeTime(l.ledger_time));
    if (l.fee_base != null) set('xrpl-base-fee', drops(l.fee_base));
    if (l.reserve_base != null) {
      set('xrpl-reserve', xrpOnly(l.reserve_base) + ' base + ' + xrpOnly(l.reserve_inc) + ' per object');
    }
    if (l.txn_count != null) {
      set('xrpl-txn-count', Number(l.txn_count).toLocaleString());
      history.push({ index: l.ledger_index, txns: Number(l.txn_count) });
      if (history.length > 20) history.shift();
      var sum = 0;
      for (var i = 0; i < history.length; i++) sum += history[i].txns;
      set('xrpl-txn-avg', (sum / history.length).toFixed(1) + ' avg over last ' + history.length + ' ledgers');
    }
    if (l.validated_ledgers) set('xrpl-range', l.validated_ledgers);
    set('xrpl-updated', new Date().toLocaleTimeString());
    window.HCN_XRPL_LAST = l;
  }

  function onMessage(ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.type === 'ledgerClosed') { showLedger(msg); return; }
    if (msg.type === 'response' && msg.status === 'success' && msg.result) {
      var r = msg.result;
      if (r.info) { // server_info
        var vl = r.info.validated_ledger || {};
        if (r.info.complete_ledgers) set('xrpl-range', r.info.complete_ledgers);
        if (r.info.load_factor != null) set('xrpl-load', String(r.info.load_factor));
        if (vl.seq) showLedger({ ledger_index: vl.seq,
          fee_base: vl.base_fee_xrp != null ? Math.round(vl.base_fee_xrp * 1e6) : undefined,
          reserve_base: vl.reserve_base_xrp != null ? Math.round(vl.reserve_base_xrp * 1e6) : undefined,
          reserve_inc: vl.reserve_inc_xrp != null ? Math.round(vl.reserve_inc_xrp * 1e6) : undefined });
      } else if (r.ledger_index != null) { // subscribe response
        showLedger(r);
      }
    }
  }

  function nextServer() {
    serverIdx = (serverIdx + 1) % servers.length;
    if (serverIdx === 0) retryDelay = Math.min(retryDelay * 2, 30000);
  }

  function connect() {
    var url = servers[serverIdx];
    status('CONNECTING', 'Connecting to ' + url + ' ...');
    set('xrpl-server', url);
    try { ws = new WebSocket(url); } catch (e) { nextServer(); setTimeout(connect, retryDelay); return; }
    var opened = false;
    connectTimer = setTimeout(function () { if (!opened) { try { ws.close(); } catch (e) {} } }, CONNECT_TIMEOUT_MS);
    ws.onopen = function () {
      opened = true; clearTimeout(connectTimer); retryDelay = 2000;
      status('LIVE', 'Live from ' + url + ' (read-only)');
      send({ command: 'server_info' });
      send({ command: 'subscribe', streams: ['ledger'] });
    };
    ws.onmessage = onMessage;
    ws.onerror = function () { /* onclose handles fallback */ };
    ws.onclose = function () {
      clearTimeout(connectTimer);
      status('RECONNECTING', (opened ? 'Lost ' : 'Could not reach ') + url + ', trying the next server ...');
      nextServer();
      setTimeout(connect, opened ? 1000 : retryDelay);
    };
  }

  function start() {
    // Optional: read server list from data/config.json (falls back to defaults).
    var base = cfgAttr || 'data/config.json';
    if (window.fetch) {
      fetch(base, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) {
          if (cfg && Array.isArray(cfg.servers) && cfg.servers.length) {
            servers = cfg.servers.filter(function (s) { return /^wss:\/\//.test(s); });
            if (!servers.length) servers = DEFAULT_SERVERS.slice();
          }
          if (cfg && cfg.connectTimeoutMs) CONNECT_TIMEOUT_MS = cfg.connectTimeoutMs;
        })
        .catch(function () {})
        .then(connect);
    } else { connect(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
