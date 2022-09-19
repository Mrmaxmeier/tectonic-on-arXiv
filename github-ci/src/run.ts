import { spawnSync, spawn } from "child_process"
import { existsSync, readFileSync } from "fs"
import { Repository, Commit, Reset, Merge } from "nodegit"
import { Job, PR_RUN_DATASET } from "./misc"
import { report_path, markdown_report, get_changes } from "./report"


const sleep = (m: number) => new Promise(r => setTimeout(r, m))

async function open_repo() {
    let repo = await Repository.open("/repo")
    console.log("waiting a sec for fetchAll")
    await sleep(1000)
    console.log("fetchAll")
    await repo.fetchAll()
    return repo
}

export async function get_merge_base(head_sha: string, base_sha: string) {
    let repo = await open_repo()
    let head = await Commit.lookup(repo, head_sha)
    let base = await Commit.lookup(repo, base_sha)
    let merge_base = await Merge.base(repo, head.id(), base.id())
    return merge_base.tostrS()
}

export async function run_check({ context, head_sha, head_branch, base_sha, check_run_id }: Job) {
    if (existsSync(report_path(head_sha))) {
        console.log("skipping", head_sha)
        if (context && check_run_id)
            await context.octokit.checks.update(context.repo({
                check_run_id,
                status: 'completed',
                conclusion: 'cancelled',
                completed_at: new Date().toISOString(),
            }))
        return
    }
    console.log("run_check", head_sha, head_branch, base_sha)

    let repo = await open_repo()

    const started_at = new Date().toISOString()
    const name = 'tectonic-on-arXiv'


    let etaTimer = undefined

    try {
        let commit = await Commit.lookup(repo, head_sha)
        if (!commit)
            throw new Error(`unknown commit ${head_sha}`)

        await Reset.reset(repo, commit, Reset.TYPE.HARD, {})
        console.log("did checkout")

        console.log("building...")
        if (context && check_run_id) {
            await context.octokit.checks.update(context.repo({
                check_run_id,
                status: 'in_progress',
                output: {
                    title: 'building...',
                    summary: ''
                }
            }))
        }

        spawnSync("git", ["submodule", "update", "--init"], {
            cwd: "/repo"
        })

        let build_res = spawnSync("cargo", ["build", "--release"], {
            cwd: "/repo"
        })

        console.log("finished building")

        if (build_res.status !== 0) {
            if (context && check_run_id)
                await context.octokit.checks.update(context.repo({
                    check_run_id,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    conclusion: 'cancelled',
                    output: {
                        title: 'Build Failed',
                        summary: `couldn't build\n\`\`\`\n${build_res.stderr}\n${build_res.output}\n\`\`\``
                    }
                }))

            return
        }

        if (context && check_run_id)
            await context.octokit.checks.update(context.repo({
                check_run_id,
                status: 'in_progress',
                output: {
                    title: 'Starting Testrun',
                    summary: 'Waiting for results...'
                }
            }))

        let report_start = new Date()
        etaTimer = setInterval(() => {
            let res = readFileSync(report_path(head_sha))
            let lines = res.toString().match(/\n/g)!.length
            let seconds = (new Date() as any - (report_start as any)) as number / 1000
            let speed = (lines / seconds)
            let SAMPLES = 7979 // TODO: read dataset json
            let etaSecs = Math.round((SAMPLES - lines) / speed)
            let etaT = etaSecs > 270 ? Math.round(etaSecs / 60) + 'm' : etaSecs + 's'
            let eta = `ETA: ${etaT} - ${lines} / ${SAMPLES}`
            console.log(`still going ${head_sha} ${eta}`)
            if (context && check_run_id && base_sha) {
                let summary = ''
                try {
                    summary = markdown_report(PR_RUN_DATASET, base_sha, head_sha, eta)
                } catch (e) {
                    summary = '```\n' + e + '\n```'
                }

                context.octokit.checks.update(context.repo({
                    check_run_id,
                    status: 'in_progress',
                    output: {
                        title: eta,
                        summary
                    },
                    details_url: `https://tt.ente.ninja/#/compare/${base_sha}/${head_sha}`
                }))
            }
        }, 15000)

        console.log("starting report_ci.py")
        let proc = spawn("python3", ["report_ci.py", `datasets/${PR_RUN_DATASET}`, "/repo", head_sha], {
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

        if (context && check_run_id && base_sha) {
            await sleep(1500)
            let { different } = get_changes(base_sha, head_sha)
            await context.octokit.checks.update(context.repo({
                check_run_id,
                status: 'completed',
                conclusion: different ? 'failure' : 'success',
                completed_at: new Date().toISOString(),
                output: {
                    title: `${different} changes`,
                    summary: markdown_report(PR_RUN_DATASET, base_sha, head_sha)
                },
                details_url: `https://tt.ente.ninja/#/compare/${base_sha}/${head_sha}`
            }))
        }
    } catch (e) {
        if (etaTimer)
            clearInterval(etaTimer)

        if (context && check_run_id)
            await context.octokit.checks.create(context.repo({
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
