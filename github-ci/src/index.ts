import { Application, Context } from 'probot'
import { Merge, Repository, Commit, Reset } from 'nodegit'
import { spawnSync, spawn } from 'child_process'
import { fstat, readFile, readFileSync } from 'fs'

const sleep = (m: number) => new Promise(r => setTimeout(r, m))


export = (app: Application) => {
  async function check(context: Context) {
    if (!context.payload.check_suite)
      return
    const started_at = new Date().toISOString()
    const { head_branch, head_sha, pull_requests } = context.payload.check_suite
    const name = 'tectonic-on-arXiv'

    console.log("processing check request", head_sha)

    if (!head_branch) {
      console.log("no head branch??")
      return
    }

    if (!pull_requests || pull_requests.length === 0) {
      console.log("pull_requests is empty")
      return
    }

    let base_sha = pull_requests[0].base.sha

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
      let repo = await Repository.open("/repo")
      await repo.fetchAll()
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
        console.log("etaTimer fired")
        let res = readFileSync('/root/reports/' + head_sha + '.jsonl')
        let lines = res.toString().match(/\n/g)!.length
        let seconds = (new Date() as any - (report_start as any)) as number / 1000
        let SAMPLES = 2500
        let etaSecs = Math.round((SAMPLES - lines) / (lines / seconds) / 60)
        let eta = `${etaSecs}s - ${lines} / ${SAMPLES}`
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
          summary: 'reports/' + head_sha + '.jsonl'
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


  app.on(['check_suite.requested', 'check_run.rerequested'], check)
}
