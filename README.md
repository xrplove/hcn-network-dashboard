# HCN Network Dashboard

**Hernandez Coordination Network: live cross-chain infrastructure status**

🌐 **Live page:** https://xrplove.github.io/hcn-network-dashboard/

A monitoring dashboard for the Hernandez Coordination Network. It now shows **real, live data from the XRP Ledger**, updated every time a new ledger closes (about every 3 to 5 seconds).

## Live XRP Ledger data (read-only)

The page opens a plain browser WebSocket to a public XRPL server and listens to the public `ledger` stream:

| Shown on the page | Where it comes from |
|---|---|
| Ledger index | `ledger_index` from each `ledgerClosed` message |
| Close time (shown in the visitor's own time zone) | `ledger_time` (seconds since 2000-01-01 UTC) |
| Base fee | `fee_base` (drops; 1 XRP = 1,000,000 drops) |
| Account reserve | `reserve_base` + `reserve_inc` per owned object |
| Transactions per ledger | `txn_count`, plus a rolling average of the last 20 ledgers |
| Validated range and load | `server_info` |

Servers (in order, with automatic fallback and reconnect): `wss://xrplcluster.com` → `wss://s1.ripple.com` → `wss://s2.ripple.com`. The list lives in [`data/config.json`](data/config.json).

**Safety:** the page only sends `server_info` and `subscribe`. There are **no wallets, no keys, no secrets and no signing** anywhere in this repo. Never add a seed or secret to any file here.

## What's in this repo

- `index.html`: the main dashboard (v5: portals, Sologenic layer, billboards, bridge map, build log, plus the live XRPL panel)
- `assets/xrpl-live.js`: the read-only XRPL WebSocket feed (no libraries, no build step)
- `data/config.json`: server list and public addresses to watch
- `classic/`: the original page from [xrplove/hcn-network](https://github.com/xrplove/hcn-network), folded in here, now also with the live ledger index → https://xrplove.github.io/hcn-network-dashboard/classic/
- `docs/our-universe-vip.md`: "Our Universe: The Royal Experience" vision (from the old `master` branch)
- `notes/xrpl-explorer-notes.md`: raw XRPL explorer notes that used to sit at the bottom of this README

## Run it locally

```bash
git clone https://github.com/xrplove/hcn-network-dashboard.git
cd hcn-network-dashboard
python -m http.server 8000
# open http://localhost:8000
```

## Related

- [guardian-mcp](https://github.com/xrplove/guardian-mcp): read-only MCP server for XRP Ledger accounts, balances and ledger status
- [xrpl.org WebSocket docs](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe)

## License

[MIT](LICENSE)

---

*Built by Guardian Protectors, connecting teams across blockchains • 589*
