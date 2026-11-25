import { describe, expect, it } from "vitest";
import { shiftMonthClamped } from "./til-calendar";

describe("shiftMonthClamped", () => {
	it("keeps the same day when the target month contains it", () => {
		expect(shiftMonthClamped("2026-09-16", -1)).toBe("2026-08-16");
	});

	it("clamps a long month's last day to the target month", () => {
		expect(shiftMonthClamped("2026-01-31", 1)).toBe("2026-02-28");
		expect(shiftMonthClamped("2024-01-31", 1)).toBe("2024-02-29");
		expect(shiftMonthClamped("2026-03-31", -1)).toBe("2026-02-28");
	});
});
