/**
 * The CalDAV event source.
 *
 * The source itself never talks to the network: it hands out the events the
 * sync service already fetched. That keeps the index rebuild cheap — a
 * rebuild triggered by a keystroke must not open a connection to a server.
 */

import type { CalendarEvent, EventSource } from '../core/types';
import type { CalDavService } from '../caldav/service';

export class CalDavSource implements EventSource {
	readonly id = 'caldav' as const;

	constructor(private service: CalDavService) {}

	collect(): CalendarEvent[] {
		return this.service.getEvents();
	}
}
