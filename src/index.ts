import 'dotenv/config'
import { Collector } from './impl/collector'
import invariant from 'ts-invariant'
import { Octokit } from 'octokit'
import { collector } from './collector'
import listen from './web'

invariant(
  typeof process.env.GITHUB_PAT === 'string',
  'Missing environment variable: `GITHUB_PAT`'
)

const github = new Octokit({
  auth: process.env.GITHUB_PAT,
})

function restrict(
  limit: 'existing_users' | 'contributors_only' | 'collaborators_only',
  expiry: 'one_day' | 'three_days' | 'one_week' | 'one_month' | 'six_months'
) {
  console.info(`[ ! ] Restricting to '${limit}' for '${expiry}'`)

  return github.rest.interactions.setRestrictionsForAuthenticatedUser({
    limit,
    expiry,
  })
}

collector.on('newItem', async i => {
  console.log('New item', i)

  const { time30sec, time5min, time1hr } = collector
  let shouldRestrict = false
  if (time30sec.size >= 2) {
    shouldRestrict = true
  } else if (time5min.size >= 70) {
    shouldRestrict = true
  } else if (time1hr.size >= 400) {
    shouldRestrict = true
  }

  if (!shouldRestrict) return

  collector.clear()
  const restrictionsInPlace =
    await github.rest.interactions.getRestrictionsForAuthenticatedUser()

  if (restrictionsInPlace.data.limit === 'existing_users') {
    await restrict('collaborators_only', 'three_days')
  } else {
    await restrict('existing_users', 'one_day')
  }
})

listen()
