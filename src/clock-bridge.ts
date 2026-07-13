// ============================================================
// src/clock-bridge.ts
// Synchronizes clock.html with the overlay timer via
// BroadcastChannel — without modifying the project's core.
// ============================================================

const CHANNEL_NAME = 'clock-channel';

type ClockPhase = 'pomo' | 'break';

type ClockAction =
	| { action: 'start'; seconds: number; phase: ClockPhase }
	| { action: 'tick'; seconds: number; phase: ClockPhase }
	| { action: 'phase'; phase: ClockPhase }
	| { action: 'pause' }
	| { action: 'resume' }
	| { action: 'reset' };

const channel = new BroadcastChannel(CHANNEL_NAME);

function broadcast(data: ClockAction): void {
	channel.postMessage(data);
	console.log('[clock-bridge] ►', data);
}

/** Converts "MM:SS" text into total seconds. */
function parseSeconds(text: string | null | undefined): number {
	const parts = (text ?? '').trim().split(':').map(Number);
	if (parts.length !== 2 || parts.some(Number.isNaN)) return 0;
	return parts[0] * 60 + parts[1];
}

window.addEventListener('load', () => {
	const timerContainer = document.querySelector('.timer');
	const timerEl = document.querySelector('.timer .timer-countdown');
	const titleEl = document.querySelector('.timer .timer-title');

	if (!timerEl || !timerContainer) {
		console.warn('[clock-bridge] Element .timer-countdown not found.');
		return;
	}

	/** Determines the current phase by reading the text of .timer-title. */
	function getPhase(): ClockPhase {
		const text = (titleEl?.textContent ?? '').toLowerCase();
		return text.includes('break') ? 'break' : 'pomo';
	}

	let prevHidden = timerContainer.classList.contains('hidden');
	let prevSeconds = parseSeconds(timerEl.textContent);
	let timerActive = false;
	let pauseSent = false;
	let lastTickTime = 0;

	// ── Pause Polling (600ms) ──────────────────────────────────
	// PomodoroTimer.pause() only clears the setInterval — no changes
	// are made to the DOM. We detect this indirectly: if the timer is
	// visible and the text hasn't changed for over 1.2s, we consider it paused.
	setInterval(() => {
		if (timerContainer!.classList.contains('hidden')) return;
		if (!timerActive || pauseSent) return;
		if (Date.now() - lastTickTime > 1200) {
			pauseSent = true;
			broadcast({ action: 'pause' });
		}
	}, 600);

	function onMutation(): void {
		const isHidden = timerContainer!.classList.contains('hidden');
		const seconds = parseSeconds(timerEl!.textContent);

		// ── Timer appeared (left hidden state) → START ────────────────
		// PomodoroTimer calls reveal() and THEN renderCountdown() in the
		// same synchronous tick. We use setTimeout(0) to let JS complete
		// the current frame before reading the updated text.
		if (prevHidden && !isHidden) {
			setTimeout(() => {
				const freshSeconds = parseSeconds(timerEl!.textContent);
				timerActive = true;
				pauseSent = false;
				lastTickTime = Date.now();
				broadcast({ action: 'start', seconds: freshSeconds, phase: getPhase() });
			}, 0);
			prevHidden = false;
			prevSeconds = parseSeconds(timerEl!.textContent);
			return;
		}

		// ── Timer disappeared (returned to hidden state) → RESET ───────
		if (!prevHidden && isHidden) {
			timerActive = false;
			pauseSent = false;
			broadcast({ action: 'reset' });
			prevHidden = true;
			prevSeconds = 0;
			return;
		}

		// ── Text changed while visible → tick (or resume after pause) ──
		if (!isHidden && seconds !== prevSeconds) {
			if (pauseSent) {
				// Was paused, now resumed
				pauseSent = false;
				broadcast({ action: 'resume' });
			}
			timerActive = true;
			lastTickTime = Date.now();
			broadcast({ action: 'tick', seconds, phase: getPhase() });
			prevSeconds = seconds;
		}

		prevHidden = isHidden;
	}

	// Observes class changes on .timer (hidden ↔ visible)
	new MutationObserver(onMutation).observe(timerContainer, {
		attributes: true,
		attributeFilter: ['class'],
	});

	// Observes text changes on .timer-countdown
	new MutationObserver(onMutation).observe(timerEl, {
		childList: true,
		subtree: true,
		characterData: true,
	});

	// Observes changes on .timer-title (focus ↔ break)
	if (titleEl) {
		let prevTitle = titleEl.textContent ?? '';
		new MutationObserver(() => {
			const newTitle = titleEl.textContent ?? '';
			if (newTitle !== prevTitle) {
				prevTitle = newTitle;
				broadcast({ action: 'phase', phase: getPhase() });
			}
		}).observe(titleEl, { childList: true, subtree: true, characterData: true });
	}

	console.log(`[clock-bridge] Active — channel "${CHANNEL_NAME}"`);
});
