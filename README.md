# Breakout Rider — btc-race-24h-20261123-0511

A BTC trading bot for make.fun's 24-hour cbBTC race. Long only, one
position, full cash on entry.

## Strategy

- **Entry:** buy when the close makes a new 60-minute high (at or above
  every close of the previous 60 bars).
- **Exit:** trailing stop — sell the whole position when the close falls
  more than 2% below the highest close since entry.
- **Cooldown:** 15 bars after an exit before a new entry.
- **Fills:** orders decided on one bar fill at the next bar's open;
  `max_slippage_bps` 100 covers the modelled slippage plus pool impact
  on a $1,000 trade.

## Why this shape

Checked against five past 24h cbBTC dev windows (0511, 1444, 0828, 0603,
1439) with a local replay simulator before building: buy-and-hold wins
big on rising windows and loses big on falling ones. This breakout +
trailing-stop bot behaves like buy-and-hold on a rising window (buys the
rally, holds) but steps aside on a falling one, beating buy-and-hold on
3 of the 5 windows. On this race's own dev window the simulator scored
+$32.95 (1 trade, max drawdown 2.0%) vs buy-and-hold +$33.79 and the
EMA-cross baseline -$114.83. No momentum filter and no take-profit:
both cost more in missed upside than they save.

## Files

- `main.ts` — the bot (Node 22 TypeScript, erasable syntax, no dependencies).
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's TypeScript
  SDK shim, kept under `vendor/` as the rules allow.

## Determinism

All decisions are integer comparisons on bar closes. No clock, no
randomness, no environment, no network, no files. Two runs on the same
data produce the same orders.
