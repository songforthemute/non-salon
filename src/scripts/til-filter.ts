const trigger = document.querySelector<HTMLButtonElement>("#date-trigger");
const calendar = document.querySelector<HTMLElement>("#til-calendar");
const days = document.querySelector<HTMLElement>("#calendar-days");
const monthLabel = document.querySelector<HTMLElement>("#month-label");
const dateSummary = document.querySelector<HTMLElement>("#date-summary");
const clearButton = document.querySelector<HTMLButtonElement>("#date-clear");
const resultSummary = document.querySelector<HTMLElement>("#result-summary");
const noResults = document.querySelector<HTMLElement>("#no-results");
const rows = [...document.querySelectorAll<HTMLElement>(".til-result")];
const topicButtons = [...document.querySelectorAll<HTMLButtonElement>(".topic")];

if (
	trigger &&
	calendar &&
	days &&
	monthLabel &&
	dateSummary &&
	clearButton &&
	resultSummary &&
	noResults
) {
	const params = new URLSearchParams(location.search);
	const validDate = (value: string | null): value is string =>
		Boolean(
			value &&
				/^\d{4}-\d{2}-\d{2}$/.test(value) &&
				!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
				new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
		);
	const knownTopic = (value: string) =>
		topicButtons.some((button) => button.dataset.topic?.toLowerCase() === value.toLowerCase());
	let topic = params.get("topic") || "";
	if (!knownTopic(topic)) topic = "";
	let start: string | null = validDate(params.get("from")) ? params.get("from") : null;
	let end: string | null = start && validDate(params.get("to")) ? params.get("to") : null;
	if (start && end && end < start) [start, end] = [end, start];
	let hover: string | null = null;
	const initialDate = start || rows[0]?.dataset.date || new Date().toISOString().slice(0, 10);
	let visibleMonth = new Date(`${initialDate.slice(0, 7)}-01T00:00:00Z`);

	const iso = (date: Date) => date.toISOString().slice(0, 10);
	const addDays = (value: string, amount: number) => {
		const date = new Date(`${value}T00:00:00Z`);
		date.setUTCDate(date.getUTCDate() + amount);
		return iso(date);
	};
	const shortDate = (value: string) =>
		new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});
	const dateLabel = (value: string) =>
		new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});
	const rangeLabel = (from: string, to: string | null) => {
		if (!to) return dateLabel(from);
		if (from.slice(0, 4) !== to.slice(0, 4)) return `${dateLabel(from)}–${dateLabel(to)}`;
		return `${shortDate(from)}–${shortDate(to)}, ${to.slice(0, 4)}`;
	};

	function syncUrl() {
		const next = new URL(location.href);
		for (const key of ["topic", "from", "to"]) next.searchParams.delete(key);
		if (topic) next.searchParams.set("topic", topic);
		if (start) next.searchParams.set("from", start);
		if (end) next.searchParams.set("to", end);
		history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
	}

	function updateResults() {
		if (!resultSummary || !noResults || !dateSummary || !clearButton) return;
		let count = 0;
		for (const row of rows) {
			const tags: string[] = JSON.parse(row.dataset.tags || "[]");
			const matchesTopic = !topic || tags.some((tag) => tag.toLowerCase() === topic.toLowerCase());
			const date = row.dataset.date || "";
			const matchesDate = !start || (date >= start && date <= (end || start));
			row.hidden = !(matchesTopic && matchesDate);
			if (!row.hidden) count++;
		}
		for (const button of topicButtons)
			button.setAttribute(
				"aria-pressed",
				String((button.dataset.topic || "").toLowerCase() === topic.toLowerCase()),
			);
		resultSummary.textContent = [
			`${count} ${count === 1 ? "note" : "notes"}`,
			...(topic ? [topic] : []),
			...(start ? [rangeLabel(start, end)] : []),
		].join("  ·  ");
		noResults.hidden = count !== 0;
		dateSummary.textContent = start
			? end
				? `${shortDate(start)} – ${shortDate(end)}`
				: shortDate(start)
			: "Select a date";
		clearButton.disabled = !start;
		trigger?.setAttribute(
			"aria-label",
			start ? `Filter by date: ${dateSummary.textContent}` : "Filter by date",
		);
		syncUrl();
	}

	function renderCalendar(focusDate?: string) {
		if (!days || !monthLabel) return;
		monthLabel.textContent = visibleMonth
			.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
			.toUpperCase();
		const year = visibleMonth.getUTCFullYear();
		const month = visibleMonth.getUTCMonth();
		const offset = (visibleMonth.getUTCDay() + 6) % 7;
		const first = new Date(Date.UTC(year, month, 1 - offset));
		const weekCount = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7);
		const fragment = document.createDocumentFragment();
		const previewEnd = start && !end && hover ? hover : null;
		const rangeStart = start && previewEnd && previewEnd < start ? previewEnd : start;
		const rangeEnd = previewEnd && start && previewEnd < start ? start : end || previewEnd;
		for (let i = 0; i < weekCount * 7; i++) {
			const date = new Date(first);
			date.setUTCDate(first.getUTCDate() + i);
			const value = iso(date);
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.date = value;
			button.textContent = String(date.getUTCDate());
			button.setAttribute("aria-label", dateLabel(value));
			button.setAttribute("aria-pressed", String(value === start || value === end));
			if (date.getUTCMonth() !== month) button.dataset.outside = "true";
			if (rangeStart && rangeEnd && value > rangeStart && value < rangeEnd)
				button.dataset.inRange = "true";
			if (previewEnd && rangeStart && rangeEnd && value > rangeStart && value < rangeEnd)
				button.dataset.preview = "true";
			if (value === start || value === end) button.dataset.selected = "true";
			fragment.append(button);
		}
		days.replaceChildren(fragment);
		if (focusDate)
			days.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`)?.focus();
	}

	function selectDate(value: string) {
		if (!start || end) {
			start = value;
			end = null;
		} else if (value !== start) {
			if (value < start) [start, end] = [value, start];
			else end = value;
		}
		hover = null;
		visibleMonth = new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
		updateResults();
		renderCalendar(value);
	}

	function changeMonth(amount: number, focusDate?: string) {
		visibleMonth = new Date(
			Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + amount, 1),
		);
		renderCalendar(focusDate);
	}

	function closeCalendar() {
		if (!calendar || !trigger) return;
		calendar.hidden = true;
		trigger.setAttribute("aria-expanded", "false");
		hover = null;
	}

	trigger.addEventListener("click", () => {
		calendar.hidden = !calendar.hidden;
		trigger.setAttribute("aria-expanded", String(!calendar.hidden));
		if (!calendar.hidden) renderCalendar();
	});
	document.querySelector("#month-prev")?.addEventListener("click", () => changeMonth(-1));
	document.querySelector("#month-next")?.addEventListener("click", () => changeMonth(1));
	clearButton.addEventListener("click", () => {
		start = null;
		end = null;
		hover = null;
		updateResults();
		renderCalendar();
	});
	for (const button of topicButtons)
		button.addEventListener("click", () => {
			topic = button.dataset.topic || "";
			updateResults();
		});
	days.addEventListener("click", (event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>("button[data-date]");
		if (button?.dataset.date) selectDate(button.dataset.date);
	});
	days.addEventListener("pointerover", (event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>("button[data-date]");
		if (button?.dataset.date && start && !end && button.dataset.date !== hover) {
			hover = button.dataset.date;
			renderCalendar();
		}
	});
	days.addEventListener("pointerleave", () => {
		if (hover) {
			hover = null;
			renderCalendar();
		}
	});
	days.addEventListener("keydown", (event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>("button[data-date]");
		const value = button?.dataset.date;
		if (!value) return;
		const moves: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7,
			ArrowDown: 7,
		};
		let next: string | undefined;
		if (event.key in moves) next = addDays(value, moves[event.key]);
		else if (event.key === "Home")
			next = addDays(value, -((new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7));
		else if (event.key === "End")
			next = addDays(value, 6 - ((new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7));
		else if (event.key === "PageUp" || event.key === "PageDown") {
			const date = new Date(`${value}T00:00:00Z`);
			date.setUTCMonth(date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1));
			next = iso(date);
		}
		if (next) {
			event.preventDefault();
			if (next.slice(0, 7) !== value.slice(0, 7))
				visibleMonth = new Date(`${next.slice(0, 7)}-01T00:00:00Z`);
			renderCalendar(next);
		}
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !calendar.hidden) {
			closeCalendar();
			trigger.focus();
		}
	});
	document.addEventListener("pointerdown", (event) => {
		if (
			!calendar.hidden &&
			!calendar.contains(event.target as Node) &&
			!trigger.contains(event.target as Node)
		)
			closeCalendar();
	});
	updateResults();
	renderCalendar();
}
