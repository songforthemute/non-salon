/** Move a calendar date by whole months, keeping the day when possible. */
export function shiftMonthClamped(value: string, amount: number): string {
	const date = new Date(`${value}T00:00:00Z`);
	const targetMonth = date.getUTCMonth() + amount;
	const lastDay = new Date(Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
	return new Date(
		Date.UTC(date.getUTCFullYear(), targetMonth, Math.min(date.getUTCDate(), lastDay)),
	)
		.toISOString()
		.slice(0, 10);
}
