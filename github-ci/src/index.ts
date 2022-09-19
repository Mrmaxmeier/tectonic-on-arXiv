import { Probot, Context } from 'probot'
import { queue } from 'async'
import { get_merge_base, run_check } from './run'
import { Job } from './misc'

const jobs = queue<Job>(async (job, _) => await run_check(job), 1)

export = function (app: Probot) {
  /*
  async function check(context: Context) {
    // NOTE(2020-10-25): check_suite.pull_requests is not reliable.
    if (!context.payload.check_suite) {
      console.log("check without check_suite")
      return
    }
    const { head_branch, head_sha } = context.payload.check_suite
    if (requests[head_sha]) {
      return console.log("check request already pending/done", head_sha)
    }
    requests[head_sha] = true
    let repo = await open_repo()
    let base_sha = await get_base_report(repo, head_sha)
    if (!base_sha) {
      console.log("check without base_sha")
      return
    }
    await run_check(context, repo, head_sha, head_branch, base_sha)
  }
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  */
  app.on(["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"], async (context: Context<"pull_request">) => {
    let head_sha: string = context.payload.pull_request.head.sha
    let head_branch: string = context.payload.pull_request.head.ref
    let base_sha: string = context.payload.pull_request.base.sha
    base_sha = await get_merge_base(head_sha, base_sha)
    console.log(`queueing run: base=${base_sha} head=${head_sha}`)
    let { data: { id: check_run_id } } = await context.octokit.checks.create(context.repo({
      name: 'tectonic-on-arXiv',
      head_branch,
      head_sha,
      status: 'queued',
    }))
    // ensure that base_sha has a report ready
    jobs.push({ head_sha: base_sha })
    // start regression check
    jobs.push({ context, head_sha, head_branch, base_sha, check_run_id })
  })
}
