// Timeline helper — wraps appendEvent with typed payload construction.
//
// The history store already exposes makeEvent + appendEvent; this module is a
// thin facade so callers express intent by event type and don't repeat the
// makeEvent ceremony. The cap (200) is enforced inside appendEvent.

import type { TimelineEventType, HistoryEvent } from './types';
import { appendEvent, makeEvent } from '../stores/history';

/** Append a typed timeline event. Returns the appended event. */
export function appendHistory(
  type: TimelineEventType,
  payload: { countryId?: string; userId: string; message: string; id?: string; timestamp?: number },
): HistoryEvent {
  return appendEvent(makeEvent(type, payload));
}