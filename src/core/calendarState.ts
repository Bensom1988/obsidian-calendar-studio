/**
 * Shared UI state: which day is selected and which month is in view.
 *
 * The sidebar mini calendar and the main view both read and write it, so
 * selecting a day in one is reflected in the other.
 */
export class CalendarState {
	private selectedDate = new Date();
	private anchorDate = new Date();
	private listeners = new Set<() => void>();

	get selected(): Date {
		return this.selectedDate;
	}

	get anchor(): Date {
		return this.anchorDate;
	}

	select(date: Date): void {
		this.selectedDate = new Date(date.getTime());
		this.anchorDate = new Date(
			this.selectedDate.getFullYear(),
			this.selectedDate.getMonth(),
			1,
		);
		this.notify();
	}

	/** Move the visible month without changing the selection. */
	setAnchor(date: Date): void {
		this.anchorDate = new Date(date.getFullYear(), date.getMonth(), 1);
		this.notify();
	}

	goToToday(): void {
		this.select(new Date());
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (error) {
				console.error('[calendar-studio] state listener failed:', error);
			}
		}
	}
}
