/**
 * AA bill settlement: net balances + greedy transfer minimization.
 * All amounts are integer cents to avoid floating-point errors.
 */

/**
 * Split amountCents equally among participants.
 * Remainder cents go to the first participants (stable order).
 */
export function splitEqually(amountCents, participants) {
  if (!participants.length) return {};
  const n = participants.length;
  const base = Math.floor(amountCents / n);
  const remainder = amountCents - base * n;
  const shares = {};
  participants.forEach((p, i) => {
    shares[p] = base + (i < remainder ? 1 : 0);
  });
  return shares;
}

/**
 * Compute net balance per person (positive = owed money, negative = owes money).
 */
export function computeBalances(people, expenses) {
  const balances = Object.fromEntries(people.map((p) => [p, 0]));

  for (const exp of expenses) {
    const { payer, participants, amountCents } = exp;
    if (!participants.length || amountCents <= 0) continue;

    balances[payer] = (balances[payer] ?? 0) + amountCents;

    const shares = splitEqually(amountCents, participants);
    for (const [person, share] of Object.entries(shares)) {
      balances[person] = (balances[person] ?? 0) - share;
    }
  }

  return balances;
}

/**
 * Greedy debt simplification — minimizes number of transfers (at most n-1).
 */
export function simplifyTransfers(balances) {
  const entries = Object.entries(balances)
    .filter(([, v]) => v !== 0)
    .map(([person, cents]) => ({ person, cents }));

  const creditors = entries
    .filter((e) => e.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const debtors = entries
    .filter((e) => e.cents < 0)
    .sort((a, b) => a.cents - b.cents);

  const transfers = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i].cents;
    const debt = -debtors[j].cents;
    const amount = Math.min(credit, debt);

    transfers.push({
      from: debtors[j].person,
      to: creditors[i].person,
      amountCents: amount,
    });

    creditors[i].cents -= amount;
    debtors[j].cents += amount;

    if (creditors[i].cents === 0) i++;
    if (debtors[j].cents === 0) j++;
  }

  return transfers;
}

/**
 * Full settlement: balances + simplified transfers.
 */
export function settle(people, expenses) {
  const balances = computeBalances(people, expenses);
  const transfers = simplifyTransfers(balances);
  return { balances, transfers };
}

export function formatCents(cents, currency = "¥") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${currency}${(abs / 100).toFixed(2)}`;
}

export function parseYuanToCents(yuan) {
  const n = Number(yuan);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
