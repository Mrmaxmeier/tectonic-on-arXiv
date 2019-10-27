import { Application, Context } from 'probot'
import { Merge, Repository, Commit, Reset } from 'nodegit'
import { spawnSync, spawn } from 'child_process'
import { readFileSync, existsSync } from 'fs'

const sleep = (m: number) => new Promise(r => setTimeout(r, m))

async function open_repo() {
  let repo = await Repository.open("/repo")
  console.log("waiting a sec for fetchAll")
  await sleep(2500)
  console.log("fetchAll")
  await repo.fetchAll()
  return repo
}

async function get_base_report(repo: Repository, head_sha: string): Promise<string | null> {
  let commit = await Commit.lookup(repo, head_sha)
  let master = await repo.getBranchCommit("origin/oxidize")
  let merge_base = await Merge.base(repo, commit.id(), master.id())
  console.log("get_base_report merge_base", merge_base.tostrS())
  let current = await Commit.lookup(repo, merge_base)
  for (let i = 0; i < 100; i++) {
    let sha = current.id().tostrS()
    if (existsSync("/root/reports/" + sha + ".jsonl")) {
      return sha
    }
    let parent = await commit.parent(0)
    current = await Commit.lookup(repo, parent)
  }
  return null
}

async function run_check(context: Context, repo: Repository, head_sha: string, head_branch: string, base: string) {
  const started_at = new Date().toISOString()
  const name = 'tectonic-on-arXiv'

  console.log("run_check", head_sha, head_branch, base)

  let { data: { id: check_run_id } } = await context.github.checks.create(context.repo({
    name,
    head_branch,
    head_sha,
    status: 'queued',
    started_at,
    output: {
      title: 'git checkout',
      summary: `\`${head_sha}\``
    }
  }))

  let etaTimer = undefined

  try {
    let commit = await Commit.lookup(repo, head_sha)
    if (!commit) {
      await context.github.checks.update(context.repo({
        check_run_id,
        status: 'completed',
        conclusion: 'cancelled',
        completed_at: new Date().toISOString(),
        output: {
          title: 'tectonic-on-arXiv',
          summary: 'couldn\'t find commit'
        }
      }))
      return
    }

    await Reset.reset(repo, commit, Reset.TYPE.HARD, {})
    console.log("did checkout")

    await context.github.checks.update(context.repo({
      check_run_id,
      status: 'in_progress',
      output: {
        title: 'building...',
        summary: ''
      }
    }))

    console.log("finished building")

    let build_res = spawnSync("cargo", ["build", "--release"], {
      cwd: "/repo"
    })

    if (build_res.status !== 0) {
      await context.github.checks.update(context.repo({
        check_run_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        conclusion: 'cancelled',
        output: {
          title: 'tectonic-on-arXiv',
          summary: `couldn't build\n\`\`\`\n${build_res.stderr}\n${build_res.output}\n\`\`\``
        }
      }))

      return
    }
    await context.github.checks.update(context.repo({
      check_run_id,
      status: 'in_progress',
      output: {
        title: 'tectonic-on-arXiv',
        summary: ''
      }
    }))

    let report_start = new Date()
    etaTimer = setInterval(() => {
      let res = readFileSync('/root/reports/' + head_sha + '.jsonl')
      let lines = res.toString().match(/\n/g)!.length
      let seconds = (new Date() as any - (report_start as any)) as number / 1000
      let speed = (lines / seconds)
      let SAMPLES = 2447
      let etaSecs = Math.round((SAMPLES - lines) / speed)
      let etaT = etaSecs > 270 ? Math.round(etaSecs / 60) + 'm' : etaSecs + 's'
      let eta = `ETA: ${etaT} - ${lines} / ${SAMPLES}`
      console.log("still goin " + eta)
      context.github.checks.update(context.repo({
        check_run_id,
        status: 'in_progress',
        output: {
          title: `tectonic-on-arXiv - ${eta}`,
          summary: eta
        }
      }))
    }, 15000)

    console.log("starting report_ci.py")
    let proc = spawn("python3", ["report_ci.py", "datasets/1702", "/repo", head_sha], {
      cwd: "/root/"
    })
    proc.on("message", (msg) => { console.log("message", msg) })
    proc.on("disconnect", () => { console.log("disconnect") })
    proc.on("close", () => { console.log("close") })
    proc.on("error", (error) => { console.log("error", error) })

    // devnull stdin/stdout so that i/o buffers don't break subprocess
    proc.stdout.on("data", () => { })
    proc.stderr.on("data", () => { })
    await new Promise(resolve => proc.on("exit", resolve))
    console.log("report_ci.py finished")
    clearInterval(etaTimer)

    await context.github.checks.update(context.repo({
      check_run_id,
      status: 'completed',
      conclusion: 'neutral',
      completed_at: new Date().toISOString(),
      output: {
        title: 'tectonic-on-arXiv',
        summary: `TODO: compare reports/${head_sha}.jsonl and reports/${base}.jsonl`
      }
    }))

  } catch (e) {
    if (etaTimer)
      clearInterval(etaTimer)

    await context.github.checks.create(context.repo({
      name,
      head_branch,
      head_sha,
      status: 'completed',
      started_at,
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: 'tectonic-on-arXiv internal error',
        summary: '' + e
      }
    }))
    console.error(e)
    throw e
  }
}


let requests: { [key: string]: boolean } = {}

export = (app: Application) => {
  async function check(context: Context) {
    // NOTE: check_suite.pull_requests is not reliable.
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
  app.on(["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"], async (context: Context) => {
    let head_sha: string = context.payload.pull_request.head.sha
    let head_branch: string = context.payload.pull_request.head.ref
    if (requests[head_sha]) {
      return console.log("pull_request already pending/done", head_sha)
    }
    requests[head_sha] = true
    let repo = await open_repo()
    let base_sha = await get_base_report(repo, head_sha)
    if (!base_sha) {
      console.log("check without base_sha")
      return
    }
    await run_check(context, repo, head_sha, head_branch, base_sha)
  })
}
