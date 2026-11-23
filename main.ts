// Breakout rider for btc-race-24h-20261123-0511.
//
// Strategy (validated on five past 24h cbBTC dev windows before this build):
// buy the first close that makes a new 60-minute high, then ride it with a
// 2% trailing stop; after a stopped exit, wait 15 bars before the next entry.
// Long only, one position, full cash on entry, whole position on exit.
//
// Why this shape: on the five windows checked, buy-and-hold wins big on
// rising windows and loses big on falling ones. A 60-bar breakout with a 2%
// trail behaves like buy-and-hold on a rising window (it buys the rally and
// holds) but steps aside on a falling one (the trail exits early and the
// breakout filter keeps it out of dead-cat bounces). It beat buy-and-hold on
// 3 of the 5 windows and roughly tied it on the rising 0511 dev window
// (+$32.95 vs +$33.79 in the simulator), while the EMA-cross and RSI
// baselines lost money on the same window. No momentum filter, no
// take-profit: both cost more in missed upside than they save.
//
// All decisions are integer comparisons on bar closes (bigint), so two runs
// on the same data produce the same orders byte for byte. No clock, no
// randomness, no environment, no network, no files.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 60; // entry: close at or above the highest close of the last 60 bars
const TRAIL_BPS = 200n; // exit: close more than 2% below the peak since entry
const COOLDOWN_BARS = 15; // bars to wait after an exit before a new entry
const MAX_SLIPPAGE_BPS = 100; // fills move ~2 bps + ~17 bps pool impact on $1k; 100 bps is ample

/** Closes seen so far, raw int units (price_scale 5), oldest first. */
const closes: bigint[] = [];
/** Highest close since entry, raw int units (0n = flat). */
let peak = 0n;
/** No entry before this batch seq. */
let coolUntilSeq = -1;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);

    const holding = state.positions.get(SYMBOL);
    if (holding !== undefined) {
      // Peak starts at the first close seen while holding (the fill was at
      // this bar's open, so this close is the closest known mark for it).
      if (peak === 0n || close > peak) peak = close;
      // Trailing stop: close * 10000 < peak * (10000 - TRAIL_BPS).
      if (close * 10000n < peak * (10000n - TRAIL_BPS)) {
        coolUntilSeq = state.seq + COOLDOWN_BARS;
        peak = 0n;
        return [{ side: 'sell', symbol: SYMBOL, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    peak = 0n;
    // Flat: no trading during warm-up, in cooldown, or without 60 bars of history.
    if (state.warmingUp || state.seq < coolUntilSeq) return [];
    if (closes.length < LOOKBACK_BARS + 1) return [];
    // New 60-bar high: this close at or above every close of the previous 60 bars.
    const prev = closes.slice(-LOOKBACK_BARS - 1, -1);
    for (const c of prev) {
      if (close < c) return [];
    }
    if (state.cash <= 0n) return [];
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
