import * as core from '@actions/core'

export interface Metric {
  metric: string
  value: number
  dimensions: string[]
}

export interface Event {
  title: string
  text: string
  severity: string
}

export async function sendMetrics(
  url: string,
  token: string,
  metrics: Metric[]
): Promise<void> {
  core.debug(`Sending ${metrics.length} metrics`)
  
}