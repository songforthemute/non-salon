type Point = { x: number; y: number };

type Preview = {
	trigger: HTMLAnchorElement;
	scroll: Point;
	width: number;
	height: number;
};

type Pinch = { distance: number; scale: number; anchor: Point };

const MAX_SCALE = 3;
const ZOOM_STEP = 1.25;

function initImagePreview(content: HTMLElement, dialog: HTMLDialogElement) {
	if (typeof dialog.showModal !== "function") return;
	const viewport = dialog.querySelector<HTMLElement>("[data-image-preview-viewport]");
	const stage = dialog.querySelector<HTMLElement>("[data-image-preview-stage]");
	const status = dialog.querySelector<HTMLElement>("[data-image-preview-status]");
	const original = dialog.querySelector<HTMLAnchorElement>("[data-image-preview-original]");
	const zoomOut = dialog.querySelector<HTMLButtonElement>('[data-image-preview-action="out"]');
	const zoomIn = dialog.querySelector<HTMLButtonElement>('[data-image-preview-action="in"]');
	const fit = dialog.querySelector<HTMLButtonElement>('[data-image-preview-action="fit"]');
	if (!viewport || !stage || !status || !original || !zoomOut || !zoomIn || !fit) return;

	const pointers = new Map<number, Point>();
	let preview: Preview | undefined;
	let pinch: Pinch | undefined;
	let scale = 1;
	let offset = { x: 0, y: 0 };
	let fitWidth = 0;
	let fitHeight = 0;
	let frame: number | undefined;
	let pressedBackdrop = false;

	const setStatus = (message: string) => {
		status.textContent = message;
		status.hidden = !message;
	};

	const draw = () => {
		frame = undefined;
		stage.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
		viewport.toggleAttribute("data-zoomed", scale > 1);
		viewport.toggleAttribute("data-dragging", scale > 1 && pointers.size === 1);
		zoomOut.disabled = scale <= 1;
		zoomIn.disabled = !fitWidth || scale >= MAX_SCALE;
		fit.disabled = scale <= 1;
	};

	function scheduleDraw() {
		if (frame === undefined) frame = requestAnimationFrame(draw);
	}

	const setView = (nextScale: number, x: number, y: number) => {
		scale = nextScale;
		const maxX = Math.max(0, (fitWidth * scale - viewport.clientWidth) / 2);
		const maxY = Math.max(0, (fitHeight * scale - viewport.clientHeight) / 2);
		offset = {
			x: Math.max(-maxX, Math.min(maxX, x)),
			y: Math.max(-maxY, Math.min(maxY, y)),
		};
		scheduleDraw();
	};

	const fitImage = () => {
		if (!dialog.open || !preview?.width || !preview.height) return;
		const ratio = Math.min(
			1,
			viewport.clientWidth / preview.width,
			viewport.clientHeight / preview.height,
		);
		const width = preview.width * ratio;
		const factor = fitWidth ? width / fitWidth : 1;
		fitWidth = width;
		fitHeight = preview.height * ratio;
		stage.style.width = `${fitWidth}px`;
		stage.style.height = `${fitHeight}px`;
		setView(scale, offset.x * factor, offset.y * factor);
	};

	function zoomTo(value: number) {
		const next = Math.max(1, Math.min(MAX_SCALE, value));
		const factor = next / scale;
		setView(next, offset.x * factor, offset.y * factor);
	}

	const measurePinch = () => {
		const [first, second] = pointers.values();
		if (!first || !second) return;
		const bounds = viewport.getBoundingClientRect();
		return {
			distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
			x: (first.x + second.x) / 2 - (bounds.left + bounds.width / 2),
			y: (first.y + second.y) / 2 - (bounds.top + bounds.height / 2),
		};
	};

	viewport.addEventListener("pointerdown", (event) => {
		if (!fitWidth || event.button !== 0 || pointers.size >= 2) return;
		if (event.pointerType !== "touch" && scale === 1) return;
		event.preventDefault();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		viewport.setPointerCapture(event.pointerId);
		const gesture = measurePinch();
		if (gesture) {
			// Remember the image point under the fingers before scaling it.
			pinch = {
				distance: gesture.distance,
				scale,
				anchor: { x: (gesture.x - offset.x) / scale, y: (gesture.y - offset.y) / scale },
			};
		}
		scheduleDraw();
	});

	viewport.addEventListener("pointermove", (event) => {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const current = { x: event.clientX, y: event.clientY };
		pointers.set(event.pointerId, current);
		if (pinch) {
			const gesture = measurePinch();
			if (!gesture) return;
			const next = Math.max(
				1,
				Math.min(MAX_SCALE, (pinch.scale * gesture.distance) / pinch.distance),
			);
			setView(next, gesture.x - pinch.anchor.x * next, gesture.y - pinch.anchor.y * next);
		} else if (scale > 1) {
			setView(scale, offset.x + current.x - previous.x, offset.y + current.y - previous.y);
		}
	});

	function endPointer(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		pinch = undefined;
		scheduleDraw();
	}

	viewport.addEventListener("pointerup", endPointer);
	viewport.addEventListener("pointercancel", endPointer);
	viewport.addEventListener("lostpointercapture", endPointer);
	zoomOut.addEventListener("click", () => zoomTo(scale / ZOOM_STEP));
	zoomIn.addEventListener("click", () => zoomTo(scale * ZOOM_STEP));
	fit.addEventListener("click", () => setView(1, 0, 0));
	new ResizeObserver(fitImage).observe(viewport);

	function isBackdrop(event: MouseEvent) {
		if (event.target !== dialog) return false;
		const { left, right, top, bottom } = dialog.getBoundingClientRect();
		return (
			event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
		);
	}

	dialog.addEventListener("pointerdown", (event) => {
		pressedBackdrop = event.button === 0 && isBackdrop(event);
	});
	dialog.addEventListener("click", (event) => {
		if (pressedBackdrop && isBackdrop(event)) dialog.close();
		pressedBackdrop = false;
	});

	const resetPreview = () => {
		const closed = preview;
		preview = undefined;
		pressedBackdrop = false;
		for (const id of pointers.keys()) {
			if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
		}
		pointers.clear();
		pinch = undefined;
		if (frame !== undefined) cancelAnimationFrame(frame);
		fitWidth = 0;
		fitHeight = 0;
		scale = 1;
		offset = { x: 0, y: 0 };
		draw();
		stage.replaceChildren();
		stage.removeAttribute("style");
		setStatus("");
		if (closed) {
			closed.trigger.focus({ preventScroll: true });
			window.scrollTo({ left: closed.scroll.x, top: closed.scroll.y, behavior: "instant" });
		}
	};
	dialog.addEventListener("close", () => {
		if (!dialog.open) resetPreview();
	});

	const loadImage = async (url: string, alt: string, active: Preview) => {
		const image = new Image();
		image.alt = alt;
		image.src = url;
		try {
			await image.decode();
		} catch {
			if (preview === active && dialog.open && !stage.firstElementChild) {
				setStatus("이미지를 불러오지 못했어요.");
			}
			return;
		}
		if (preview !== active || !dialog.open) return;
		if (!active.width || !active.height) {
			active.width = image.naturalWidth;
			active.height = image.naturalHeight;
			fitImage();
		}
		stage.replaceChildren(image);
		setStatus("");
	};

	content.addEventListener("click", (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			dialog.open
		)
			return;
		if (!(event.target instanceof Element)) return;
		const trigger = event.target.closest<HTMLAnchorElement>("a[data-image-preview]");
		const source = trigger?.querySelector("img");
		if (!trigger || !source) return;
		if (preview) resetPreview();

		const ready = source.complete && source.naturalWidth > 0;
		const displayedUrl = ready ? source.currentSrc : "";
		const targetUrl = trigger.dataset.previewSrc
			? new URL(trigger.dataset.previewSrc, document.baseURI).href
			: source.currentSrc || trigger.href;
		const active: Preview = {
			trigger,
			scroll: { x: window.scrollX, y: window.scrollY },
			width: Number(source.getAttribute("width")) || source.naturalWidth,
			height: Number(source.getAttribute("height")) || source.naturalHeight,
		};
		preview = active;
		original.href = trigger.href;
		if (displayedUrl) {
			const thumbnail = new Image();
			thumbnail.alt = source.alt;
			thumbnail.src = displayedUrl;
			stage.replaceChildren(thumbnail);
		} else {
			setStatus("이미지를 불러오는 중이에요.");
		}
		dialog.showModal();
		event.preventDefault();
		fitImage();
		if (targetUrl !== displayedUrl) void loadImage(targetUrl, source.alt, active);
	});

	function addHint() {
		const firstVisible = Array.from(content.querySelectorAll("a[data-image-preview]")).find(
			(link) => !link.closest("details:not([open])") && link.getClientRects().length > 0,
		);
		if (!firstVisible) return false;
		const hint = document.createElement("span");
		hint.className = "image-preview-hint";
		hint.textContent = "확대";
		hint.setAttribute("aria-hidden", "true");
		firstVisible.append(hint);
		content.removeEventListener("toggle", addHint, true);
		return true;
	}
	if (!addHint()) content.addEventListener("toggle", addHint, true);
}

const content = document.querySelector<HTMLElement>("[data-image-preview-content]");
const dialog = document.querySelector<HTMLDialogElement>("[data-image-preview-dialog]");
if (content && dialog) initImagePreview(content, dialog);
