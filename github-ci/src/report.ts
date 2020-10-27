import { readFileSync, statSync } from "fs";

export interface SampleRun {
    sample: string,
    statuscode: number,
    seconds: number,
    results: { [key: string]: string }
}

export function get_samples(sha: string) {
    let results = readFileSync(report_path(sha))
    let res = []
    for (let s of results.toString().split("\n")) {
        if (!s) continue
        let entry = JSON.parse(s)
        if (entry.meta) continue;
        res.push(entry as SampleRun)
    }
    return res
}


export function get_changes(a: string, b: string) {
    let samplesA: { [key: string]: SampleRun } = {}
    let samplesB: { [key: string]: SampleRun } = {}

    for (let sA of get_samples(a))
        samplesA[sA.sample] = sA
    for (let sB of get_samples(b))
        samplesB[sB.sample] = sB


    let samples = Array.from(new Set([...Object.keys(samplesA), ...Object.keys(samplesB)]))
    samples.sort()

    let missing = 0
    let identical = 0
    let different = 0
    let identicalSuccessful = 0
    let regressions = []
    let changes = []
    for (let sample of samples) {
        let sA = samplesA[sample]
        let sB = samplesB[sample]

        if (!sA || !sB) {
            missing++
            continue
        }


        let objects = Array.from(new Set([...Object.keys(sA.results), ...Object.keys(sB.results)]))
        objects.sort()

        let isDifferent = false
        if (sA.statuscode !== sB.statuscode) {
            isDifferent = true
            regressions.push([sA, sB])
        }

        for (let obj of objects) {
            if (sA.results[obj] !== sB.results[obj])
                isDifferent = true
        }

        if (isDifferent) {
            different++
            changes.push([sA, sB])
        } else {
            identical++
            if (sA.statuscode === 0)
                identicalSuccessful++
        }
    }

    return {
        missing,
        identical,
        different,
        regressions,
        identicalSuccessful,
        changes
    }
}

export function report_path(sha: string) {
    return '/root/reports/' + sha + '.jsonl'
}

export function markdown_report(dataset: string, a: string, b: string, eta?: string) {
    const pre = (text: string) => '`' + text + '`';

    let { missing, identical, identicalSuccessful, different, regressions, changes } = get_changes(a, b)

    function objectsTable(sA: SampleRun, sB: SampleRun) {
        let objects = Array.from(new Set([...Object.keys(sA.results), ...Object.keys(sB.results)]))
        objects.sort()
        let result = ''
        result += '| File | Base |     | PR   |\n'
        result += '| ---- | ---- | --- | ---- |\n'
        result += `| _Statuscode_ | ${cmp(sA.statuscode.toString(), sB.statuscode.toString())} |\n`
        for (let obj of objects) {
            let objA = sA.results[obj]
            let objB = sB.results[obj]
            result += `| ${pre(obj)} | ${cmp(objA, objB)} |\n`
        }
        return result
    }

    let smallestRegression = +Infinity
    let smallestRegressionText = ''

    let changesText = ''
    let cmp = (a: string, b: string) => `${pre(a)} | ${a === b ? '=' : '**≠**'} | ${pre(b)}`
    let kind = regressions.length ? 'Regression' : 'Change'
    for (let [sA, sB] of (regressions.length ? regressions : changes)) {
        changesText += `### ${sA.sample}\n`
        changesText += objectsTable(sA, sB) + '\n'

        let stat = statSync(`/root/datasets/${dataset}/${sA.sample}.gz`)
        if (stat && stat.size < smallestRegression) {
            smallestRegression = stat.size
            smallestRegressionText = `## Smallest ${kind}: [${sA.sample}](https://arxiv.org/e-print/${sA.sample})\nSize: ${stat.size} bytes gz'd\n\n${objectsTable(sA, sB)}\n`
        }
    }

    return `
  ${eta ? ':construction: This test run is currently in progress. :construction:' : ''}
  
  ${a} vs ${b}
  
  ## Summary
  
  | Samples | Count |
  | -- | -- |
  | Identical | ${identical} |
  | Identical & Successful | ${identicalSuccessful} |
  | Different | ${different} |
  | Regressions | ${regressions.length} |
  | Missing  | ${missing} |
  
  ${smallestRegressionText}
  
  ## Changes (${changes.length})
  
  ${changes.length < 80 ? changesText : 'Too many changes for GitHub\'s API payload size limit.'}
  
  `
}