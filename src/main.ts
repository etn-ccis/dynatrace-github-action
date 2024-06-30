/*
Copyright 2020 Dynatrace LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/
import * as core from '@actions/core'
import * as d from './dynatrace'
import * as yaml from 'js-yaml'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'
import type {WorkflowRunCompletedEvent} from '@octokit/webhooks-types'
import { start } from 'repl'

function buildCloudEvent(payload: WebhookPayload): unknown {
  const workflowRun = (payload as WorkflowRunCompletedEvent).workflow_run;
  // Assuming workflowRun.run_started_at and workflowRun.updated_at are date strings
  const startTime = new Date(workflowRun.run_started_at).getTime();
  const endTime = new Date(workflowRun.updated_at).getTime();
  return {
    startTime: startTime,
    endTime: endTime,
    timeout: 1,
    entitySelector: ``,
    type: 'CUSTOM_INFO',
    title: "github.workflow.run",
    properties: {
      ...workflowRun,
      run_duration_ms: endTime -startTime,
    },
  };
}


export async function run(): Promise<void> {
  try {
    const url: string = core.getInput('url')
    const token: string = core.getInput('token')

    const mStr = core.getInput('metrics')
    core.info(mStr)
    if (mStr.length > 5) {
      const metrics = yaml.load(mStr) as d.Metric[]
      d.sendMetrics(url, token, metrics)
    }

    const eStr = core.getInput('events')
    core.info(eStr)
    if (eStr.length > 5) {
      const events = yaml.load(eStr) as d.Event[]
      d.sendEvents(url, token, events)
    }

    const iStr = core.getInput('workflowCompleted')
    core.info(iStr)
    if (iStr.length > 1) {
      const cloudEvent = buildCloudEvent(github.context.payload) as d.FullEvent[];
      d.sendWorkflowCompleted(url, token, cloudEvent);
    }
  } catch (error) {
    core.setFailed('Error occurred')
  }
}

run()
