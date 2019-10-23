import { Application, Context } from 'probot'

const sleep = (m: number) => new Promise(r => setTimeout(r, m))


export = (app: Application) => {
  async function check(context: Context) {
    const startTime = new Date().toISOString()
    const { head_branch, head_sha } = context.payload.check_suite
    const name = 'tectonic-on-arXiv'

    if (!head_branch) {
      console.log("no head branch??")
      return
    }

    await context.github.checks.create(context.repo({
      name,
      head_branch,
      head_sha,
      status: 'queued',
      started_at: startTime,
      output: {
        title: 'git checkout',
        summary: ''
      }
    }))

    await sleep(10000)

    await context.github.checks.create(context.repo({
      name,
      head_branch,
      head_sha,
      status: 'in_progress',
      started_at: startTime,
      output: {
        title: 'Probot check!',
        summary: 'is running'
      }
    }))

    await sleep(10000)

    /*
    await context.github.checks.create(context.repo({
      name,
      head_branch,
      head_sha,
      status: 'completed',
      started_at: startTime,
      conclusion: 'success',
      completed_at: new Date().toISOString(),
      output: {
        title: 'tectonic-on-arXiv',
        summary: 'The check has passed!'
      }
    }))
    */
    await context.github.checks.create(context.repo({
      name,
      head_branch,
      head_sha,
      status: 'completed',
      started_at: startTime,
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: 'tectonic-on-arXiv',
        summary: 'The check has passed!'
      }
    }))
  }


  app.on(['check_suite.requested', 'check_run.rerequested'], check)
}
