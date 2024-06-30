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
import { title } from 'process'
import { stat } from 'fs'

function buildCloudEvent(payload: WebhookPayload): unknown {
  const workflowRun = (payload as WorkflowRunCompletedEvent).workflow_run;
  // Assuming workflowRun.run_started_at and workflowRun.updated_at are date strings
  const startTime = new Date(workflowRun.run_started_at).getTime();
  const endTime = new Date(workflowRun.updated_at).getTime();
  return {
    startTime: startTime,
    endTime: endTime,
    timeout: 1,
    entitySelector: `type(host),entityName(myHost)`,
    type: 'CUSTOM_INFO',
    title: "github.workflow.run",
    properties: {
      //...workflowRun,
      actor: workflowRun.actor.login,
      conclusion: workflowRun.conclusion,
      title: workflowRun.display_title,
      run_duration_ms: endTime -startTime,
    },
  };
}

function createCommonDimensions(workflowRun: any, startTime: number, endTime: number) {
  return {
    actor: workflowRun.triggering_actor.login,
    conclusion: workflowRun.conclusion,
    title: workflowRun.display_title,
    run_duration_ms: endTime - startTime,
    start_time: startTime,
    end_time: endTime,
    branch: workflowRun.head_branch,
    repository: workflowRun.head_repository.full_name,
    run_attempt: workflowRun.run_attempt,
    run_number: workflowRun.run_number,
    status: workflowRun.status,
    workflow_id: workflowRun.workflow_id,
    run_id: workflowRun.id,
    trigger_method: workflowRun.event,
    workflow_url: workflowRun.workflow_url,
    run_url: workflowRun.url,
  };
}

function buildWorkflowMetrics(payload: WebhookPayload): unknown {
  const workflowRun = (payload as WorkflowRunCompletedEvent).workflow_run;
  // Assuming workflowRun.run_started_at and workflowRun.updated_at are date strings
  const startTime = new Date(workflowRun.run_started_at).getTime();
  const endTime = new Date(workflowRun.updated_at).getTime();
  const duration = endTime - startTime;

  const workflowDurationMetric = {
    metric: 'github.workflow.duration',
    value: duration.toString(),
    dimensions: { ...createCommonDimensions(workflowRun, startTime, endTime), },
  };

  const workflowRunMetric = {
    metric: 'github.worklfow.run',
    value: 1.0,
    dimensions: { ...createCommonDimensions(workflowRun, startTime, endTime), },
  };

  let conclusionMetric: any;
  switch (workflowRun.conclusion) {
    case 'success':
      conclusionMetric = {
        metric: 'github.workflow.passed',
        value: 1,
        dimensions: { ...createCommonDimensions(workflowRun, startTime, endTime), },
      };
      break;
    case 'failure':
      conclusionMetric = {
        metric: 'github.workflow.failed',
        value: 1,
        dimensions: { ...createCommonDimensions(workflowRun, startTime, endTime), },
      };
      break;
    case 'cancelled':
      conclusionMetric = {
        metric: 'github.workflow.cancelled',
        value: 1,
        dimensions: { ...createCommonDimensions(workflowRun, startTime, endTime), },
      };
      break;
  }

  return [workflowRunMetric, workflowDurationMetric, conclusionMetric];

};



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
      //core.info(`Payload: ${JSON.stringify(github.context.payload)}`);
      //const cloudEvent = buildCloudEvent(github.context.payload) as d.FullEvent;
      const metrics = buildWorkflowMetrics(github.context.payload) as d.Metric[]
      //core.info(JSON.stringify(cloudEvent));
      d.sendMetrics(url, token, metrics)
      //d.sendWorkflowCompleted(url, token, cloudEvent);
    }
  } catch (error) {
    core.setFailed('Error occurred')
  }
}

run()
