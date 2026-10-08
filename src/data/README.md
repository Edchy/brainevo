Timeline data lives in per-era files (`events.<era>.ts`), each exporting a typed array.
`src/data/index.ts` merges and sorts them by yearsAgo descending (oldest first).
