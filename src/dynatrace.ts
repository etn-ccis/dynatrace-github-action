/*
Copyright 2020 Dynatrace LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/
import * as core from '@actions/core'
import * as github from "@actions/github"
import * as httpm from '@actions/http-client'
import { WebhookPayload } from "@actions/github/lib/interfaces";
import type { WorkflowRunCompletedEvent } from "@octokit/webhooks-types";
import { start } from 'repl';

export interface Metric {
  metric: string
  value: string
  dimensions?: Map<string, string>
}

export interface Event {
  type: string
  title?: string
  timeout?: number
  entitySelector: string
  // custom key-value properties
  properties?: Map<string, string>
}

export interface FullEvent {
  endTime: number
  startTime: number
  type: string
  title: string
  timeout: number
  entitySelector: string
  // custom key-value properties
  properties?: Map<string, string>
}

function getClient(token: string, content: string): httpm.HttpClient {
  return new httpm.HttpClient('dt-http-client', [], {
    headers: {
      Authorization: 'Api-Token '.concat(token),
      'Content-Type': content
    }
  })
}

export function safeMetricKey(mkey: string): string {
  return mkey.toLowerCase().replace(/[^.0-9a-z_-]/gi, '_')
}

export function safeDimKey(dkey: string): string {
  return dkey.toLowerCase().replace(/[^.0-9a-z_-]/gi, '_')
}

export function safeDimValue(val: string): string {
  return val
}

export async function sendMetrics(
  url: string,
  token: string,
  metrics: Metric[]
): Promise<void> {
  core.info(`Sending ${metrics.length} metrics`)

  const http: httpm.HttpClient = getClient(token, 'text/plain')
  let lines = ''

  for (const m of metrics) {
    lines = lines.concat(safeMetricKey(m.metric))
    if (m.dimensions) {
      for (const [key, value] of Object.entries(m.dimensions)) {
        if (value && value.length > 0) {
          lines = lines
            .concat(',')
            .concat(safeDimKey(key))
            .concat('="')
            .concat(safeDimValue(value))
            .concat('"')
        }
      }
    }

    lines = lines.concat(' ').concat(m.value).concat('\n')
  }
  core.info(lines)

  try {
    const res: httpm.HttpClientResponse = await http.post(
      url.replace(/\/$/, '').concat('/api/v2/metrics/ingest'),
      lines
    )
    core.info(await res.readBody())
    if (res.message.statusCode !== 202) {
      core.error(
        `HTTP request failed with status code: ${res.message.statusCode})}`
      )
    }
  } catch (error) {
    core.error(`Exception while sending HTTP metric request`)
  }
}

export async function sendEvents(
  url: string,
  token: string,
  events: Event[]
): Promise<void> {
  core.info(`Sending ${events.length} events`)
  const http: httpm.HttpClient = getClient(token, 'application/json')

  for (const e of events) {
    // create Dynatrace event structure
    let payload
    if (
      e.type === 'CUSTOM_INFO' ||
      e.type === 'CUSTOM_ALERT' ||
      e.type === 'CUSTOM_ANNOTATION' ||
      e.type === 'CUSTOM_CONFIGURATION' ||
      e.type === 'RESOURCE_CONTENTION_EVENT' ||
      e.type === 'AVAILABILITY_EVENT' ||
      e.type === 'ERROR_EVENT' ||
      e.type === 'PERFORMANCE_EVENT' ||
      e.type === 'CUSTOM_DEPLOYMENT' ||
      e.type === 'MARKED_FOR_TERMINATION'
    ) {
      core.info(`Prepare the event`)
      payload = {
        eventType: e.type,
        title: e.title,
        timeout: e.timeout,
        entitySelector: e.entitySelector,
        properties: e.properties
      }
      core.info(JSON.stringify(payload))

      try {
        const res: httpm.HttpClientResponse = await http.post(
          url.replace(/\/$/, '').concat('/api/v2/events/ingest'),
          JSON.stringify(payload)
        )
        core.info(await res.readBody())
        if (res.message.statusCode !== 201) {
          core.error(
            `HTTP request failed with status code: ${res.message.statusCode})}`
          )
        }
      } catch (error) {
        core.error(`Exception while sending HTTP event request`)
      }
    } else {
      core.info(`Unsupported event type!`)
    }
  }
}

export async function sendWorkflowCompleted(
  url: string,
  token: string,
  e: FullEvent
): Promise<void> {
  //core.info(`Sending ${event.length} events`)
  const http: httpm.HttpClient = getClient(token, 'application/json')

  //for (const e of events) {
    try {
      // create Dynatrace event structure
      let payload
        core.info(`Prepare the event`)
        payload = {
          startTime: e.startTime,
          endTime: e.endTime,
          eventType: e.type,
          title: e.title,
          timeout: e.timeout,
          entitySelector: e.entitySelector,
          properties: e.properties
        }
        core.info(JSON.stringify(payload))

        const res: httpm.HttpClientResponse = await http.post(
          url.replace(/\/$/, '').concat('/api/v2/events/ingest'),
          JSON.stringify(payload)
        )
        core.info(await res.readBody())
        if (res.message.statusCode !== 201) {
          core.error(
            `HTTP request failed with status code: ${res.message.statusCode})}`
          )
        }
      } catch (error) {
        core.error(`Exception while sending HTTP event request`)
      }
    //}
  }