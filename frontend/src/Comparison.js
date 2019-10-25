import React, { PureComponent } from 'react';
import { HOST } from './App'

class SampleComparison extends PureComponent {
    getFiles() {
        let { left, right } = this.props
        let files = Object.keys(left.results).concat(Object.keys(right.results))
        files = Array.from(new Set(files))
        files.sort()
        return files
    }
    render() {
        let resA = this.props.left && this.props.left.results
        let resB = this.props.right && this.props.right.results


        let id = this.props.sample

        let ObjectLink = ({ id }) => id ? <code><a href={HOST + "/objects/" + id}>{id}</a></code> : <i>missing</i>
        let BuildInfo = ({ statuscode }) =>
            <span>
                <b className={statuscode === 0 ? "cr-test-pass" : "cr-error"}></b>
                <span>
                    {{ 0: "build succeded", "1": "build failed", undefined: "build missing" }[statuscode] || "internal error"}
                </span>
            </span>

        return (
            <>
                <div className="crate">
                    <a href={"https://arxiv.org/abs/" + id} target="_blank" rel="noopener noreferrer">{id}</a>
                    <BuildInfo {...this.props.left} />
                    <BuildInfo {...this.props.right} />
                </div>
                {this.props.simple || !this.props.left || !this.props.right ? null :
                    this.getFiles().map(file => <div key={file} style={{ display: 'flex', padding: '0.4em' }}>
                        <span style={{ flex: "1 1" }}>{file}</span>
                        {resA[file] !== resB[file] ? (
                            <>
                                <span style={{ flexBasis: '14em' }}><ObjectLink id={resA[file]} /></span>
                                <span style={{ flexBasis: '2em' }}>&ne;</span>
                                <span style={{ flexBasis: '14em' }}><ObjectLink id={resB[file]} /></span>
                            </>
                        ) : (
                                <span style={{ flexBasis: '30em' }}>
                                    <ObjectLink id={resA[file]} />
                                </span>
                            )}
                    </div>)}
            </>
        )
    }
}

class Category extends PureComponent {
    constructor(props) {
        super(props)
        this.state = { open: false }
    }

    render() {
        if (!this.props.samples.length)
            return null
        const SIMPLE_THRESH = 25
        return (
            <div className="category">
                <div className={`header cc-${this.props.colorscheme} toggle`} onClick={_ => this.setState({ open: !this.state.open })}>
                    {this.props.kind} ({this.props.samples.length})
          {this.props.samples.length > SIMPLE_THRESH && this.state.open ? " [some results collapsed]" : null}
                </div>
                <div className={this.state.open ? "crates" : "crates hidden"} id="crates-error">
                    {this.state.open ? (
                        this.props.samples.map((s, i) => <SampleComparison key={s} sample={s} left={this.props.lefts[s]} right={this.props.rights[s]} simple={i > SIMPLE_THRESH} />)
                    ) : null}
                </div>
            </div>
        )
    }
}

export class ReportComparison extends PureComponent {
    render() {
        let samples = this.props.left.samples.concat(this.props.right.samples)
            .map(s => s.sample)
        samples = Array.from(new Set(samples))
        samples.sort()
        let A = {}
        let B = {}
        for (let sample of this.props.left.samples)
            A[sample.sample] = sample
        for (let sample of this.props.right.samples)
            B[sample.sample] = sample

        let identical = []
        let different = []
        let regressions = []
        let fixes = []
        let missing = []
        let added = []

        for (let sample of samples) {
            if (A[sample] && B[sample]) {
                let a = A[sample]
                let b = B[sample]
                let files = Object.keys(a.results).concat(Object.keys(b.results))
                let filesDiffer = false
                for (let file of files) {
                    if (a.results[file] !== b.results[file])
                        filesDiffer = true
                }
                if (a.statuscode !== b.statuscode) {
                    if (a.statuscode === 0)
                        regressions.push(sample)
                    else if (b.statuscode === 0)
                        fixes.push(sample)
                    else
                        different.push(sample)
                } else if (filesDiffer)
                    different.push(sample)
                else
                    identical.push(sample)
            } else {
                if (A[sample])
                    missing.push(sample)
                else
                    added.push(sample)
            }
        }

        return <>
            <Category kind="identical" colorscheme="test-pass" samples={identical} lefts={A} rights={B} />
            <Category kind="output changed" colorscheme="changed" samples={different} lefts={A} rights={B} />
            <Category kind="fixed" colorscheme="spurious-fixed" samples={fixes} lefts={A} rights={B} />
            <Category kind="regressed" colorscheme="spurious-regressed" samples={regressions} lefts={A} rights={B} />
            <Category kind="missing samples" colorscheme="error" samples={missing} lefts={A} rights={B} />
            <Category kind="new samples" colorscheme="test-pass" samples={added} lefts={A} rights={B} />
        </>
    }
}