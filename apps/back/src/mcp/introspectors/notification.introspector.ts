/**
 * NotificationIntrospector — lists notifications from loaded specs (spec-engine)
 * plus an optional traditional contributor.
 */

import { specLoaderEvents } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import { IntrospectionCache } from '../introspection-cache';
import type { NotificationView } from '../types';

export interface TraditionalNotificationContributor {
  listTraditionalNotifications(): NotificationView[];
}

export class NotificationIntrospector {
  constructor(
    private readonly loadedSpecs: LoadedSpec[],
    private readonly cache: IntrospectionCache,
    private readonly traditional?: TraditionalNotificationContributor,
  ) {
    specLoaderEvents.on('reload', () => this.cache.clearAll());
  }

  listNotifications(): NotificationView[] {
    const cached = this.cache.get<NotificationView[]>('notif:list');
    if (cached) return cached;
    const notifs: NotificationView[] = [];
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources) {
        for (const n of res.notifications ?? []) {
          notifs.push({
            name: n.name,
            extension: loaded.spec.name,
            resource: res.name,
            trigger: { on: n.trigger.on, when: n.trigger.when ?? 'always' },
            channel: n.channel,
            template: n.template ?? '',
            to: n.to ?? '',
            subject: n.subject ?? '',
            triggeredFrom: 'spec_engine',
          });
        }
      }
    }
    if (this.traditional) notifs.push(...this.traditional.listTraditionalNotifications());
    this.cache.set('notif:list', notifs);
    return notifs;
  }
}