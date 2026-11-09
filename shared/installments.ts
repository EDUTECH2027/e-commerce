export interface InstallmentPlan {
  percent: number
  initial: number
  remaining: number
}

/** Illustrative deposit/remaining breakdown. Pure maths; nothing here is an offer or approval. */
export function computeInstallments(price: number, percents: number[]): InstallmentPlan[] {
  return percents.map((percent) => {
    const initial = Math.round((price * percent) / 100)
    return { percent, initial, remaining: price - initial }
  })
}
