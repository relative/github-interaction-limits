import type {
  IssueCommentEvent,
  IssuesEvent,
  PullRequestEvent,
  Schema,
} from '@octokit/webhooks-types'
import { App, HttpResponse } from 'uWebSockets.js'
import invariant from 'ts-invariant'
import { createHmac } from 'crypto'

import { ignoredAuthorAssociations } from './ignored'
import { collector } from './collector'

const eventCallbacks: Record<string, CallableFunction> = {
  async issues(payload: IssuesEvent) {
    if (payload.action !== 'opened') return
    if (ignoredAuthorAssociations.includes(payload.issue.author_association))
      return
    collector.addItem(payload.issue)
  },
  async issue_comment(payload: IssueCommentEvent) {
    // console.log('issue_comment event', payload)
  },
  async pull_request(payload: PullRequestEvent) {
    if (payload.action !== 'opened') return
    if (
      ignoredAuthorAssociations.includes(
        payload.pull_request.author_association
      )
    )
      return
    collector.addItem(payload.pull_request)
  },
}

function readJson<T = {}>(res: HttpResponse): Promise<[string, T]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    res.onData((chunk, isLast) => {
      chunks.push(Buffer.from(chunk))
      if (isLast) {
        const buf = Buffer.concat(chunks)
        try {
          const body = buf.toString()
          const data = JSON.parse(body)
          resolve([body, data])
        } catch (err) {
          reject(err)
        }
      }
    })
    res.onAborted(() => {
      reject('aborted')
    })
  })
}

export default function listen() {
  invariant(
    typeof process.env.PORT === 'string' &&
      !isNaN(parseInt(process.env.PORT, 10)),
    'Missing or invalid environment variable: `PORT`'
  )
  invariant(
    typeof process.env.WEBHOOK_SECRET === 'string',
    'Missing or invalid environment variable: `WEBHOOK_SECRET`'
  )

  const webhookSecret = process.env.WEBHOOK_SECRET
  const port = parseInt(process.env.PORT, 10)

  // default in .env.example
  if (webhookSecret.startsWith('$(openssl')) {
    throw new Error(
      'Please change the WEBHOOK_SECRET in your environment variables'
    )
  }

  const app = App()
    .post('/webhook', async (res, req) => {
      let validatedSignature = false
      try {
        const githubSignature = req.getHeader('x-hub-signature-256')
        const githubEvent = req.getHeader('x-github-event')
        const contentType = req.getHeader('content-type')
        if (contentType !== 'application/json') {
          res
            .writeStatus('400 Bad Request')
            .end('Content-Type must be "application/json"')
          return
        }
        const [plain, payload] = await readJson<Schema>(res)

        const ourSignature =
          'sha256=' +
          createHmac('sha256', webhookSecret).update(plain).digest('hex')
        validatedSignature = ourSignature === githubSignature
        if (!validatedSignature) {
          res.writeStatus('403 Forbidden').endWithoutBody()
          return
        }

        const callback = eventCallbacks[githubEvent]
        if (callback) {
          await callback(payload)
        }

        res.writeStatus('204 No Content').endWithoutBody()
      } catch (err) {
        console.error('/webhook error', err)
        res.writeStatus('500 Internal Server Error')
        if (validatedSignature) {
          res.end(typeof err === 'string' ? err : (err as any).stack)
        } else {
          res.endWithoutBody()
        }
      }
    })
    .listen(port, s => {
      if (!s) {
        throw new Error(`Failed to start webserver on port ${port}`)
      }

      console.log('Listening on port', port)
    })
}
