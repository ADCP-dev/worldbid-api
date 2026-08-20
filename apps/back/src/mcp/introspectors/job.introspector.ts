/**
 * JobIntrospector — lists jobs from loaded specs (spec-engine) plus an
 * optional traditional contributor (BullMQ queues).
 */

import { specLoaderEvents } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import { IntrospectionCache } from '../introspection-cache';
import type { JobView } from '../types';

export interface TraditionalJobContributor {
  listTraditionalJobs(): JobView[];
}

export class JobIntrospector {
  constructor(
    private readonly loadedSpecs: LoadedSpec[],
    private readonly cache: IntrospectionCache,
    private readonly traditional?: TraditionalJobContributor,
  ) {
    specLoaderEvents.on('reload', () => this.cache.clearAll());
  }

  listJobs(): JobView[] {
    const cached = this.cache.get<JobView[]>('job:list');
    if (cached) return cached;
    const jobs: JobView[] = [];
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources) {
        for (const j of res.jobs ?? []) {
          jobs.push({
            name: j.name,
            source: 'spec_engine',
            extension: loaded.spec.name,
            resource: res.name,
            schedule: j.schedule,
            value: j.value,
            handler: j.handler,
            queue: j.queue,
            retries: j.retries,
            backoff: j.backoff,
            lastError: null,
          });
        }
      }
    }
    if (this.traditional) jobs.push(...this.traditional.listTraditionalJobs());
    this.cache.set('job:list', jobs);
    return jobs;
  }
}