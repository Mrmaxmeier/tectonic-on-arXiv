import React, { PureComponent } from 'react';
import { HOST } from './App'

class Sample extends PureComponent {

    render() {
        let id = this.props.sample.sample

        let objects = this.props.sample.results
        let extensions = [".log", ".xdv", ".pdf"]
            .map(ext => {
                for (let key of Object.keys(objects))
                    if (key.endsWith(ext))
                        return <a key={key} href={HOST + "/objects/" + objects[key]}>{ext}</a>
                return null
            })
            .filter(x => x !== null)

        return (
            <>
                <div className="crate">
                    <a href={"https://arxiv.org/abs/" + id} target="_blank" rel="noopener noreferrer">{id}</a>
                    <span>
                        <b className={this.props.sample.statuscode === 0 ? "cr-test-pass" : "cr-error"}></b>
                        <span>
                            {{ 0: "build succeded", "1": "build failed", undefined: "build missing" }[this.props.sample.statuscode] || "internal error"}
                        </span>
                    </span>
                    {extensions.length ? <span>
                        <b></b>
                        <span>
                            {extensions
                                .reduce((prev, curr) => [prev, ' / ', curr])}
                        </span>
                    </span> : null}
                </div>
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
        return (
            <div className="category">
                <div className={`header cc-${this.props.colorscheme} toggle`} onClick={_ => this.setState({ open: !this.state.open })}>
                    {this.props.kind} ({this.props.samples.length})
                </div>
                <div className={this.state.open ? "crates" : "crates hidden"} id="crates-error">
                    {this.state.open ? (
                        this.props.samples.map((s, i) => <Sample key={s.sample} sample={s} />)
                    ) : null}
                </div>
            </div>
        )
    }
}

export class ReportSummary extends PureComponent {
    render() {
        let samples = this.props.report.samples.map(({ sample, engines }) => ({ sample, ...engines.tectonic }))
        let ok = []
        let failed = []
        let internalError = []
        let untagged = []
        let tagged = {}
        for (let sample of samples) {
            if (sample.statuscode === 0) {
                ok.push(sample)
            } else if (sample.statuscode === 1) {
                failed.push(sample)
            } else {
                internalError.push(sample)
            }

            if (sample.tags && sample.tags.length) {
                for (let tag of sample.tags) {
                    if (!tagged[tag])
                        tagged[tag] = []
                    tagged[tag].push(sample)
                }
            } else {
                untagged.push(sample)
            }
        }

        let tags = Object.keys(tagged)
        tags.sort()

        return <>
            <Category kind="build successful" colorscheme="test-pass" samples={ok} />
            <Category kind="build failed" colorscheme="error" samples={failed} />
            <Category kind="build crashed" colorscheme="spurious-regressed" samples={internalError} />
            <br />
            <Category kind="untagged success" colorscheme="test-pass" samples={untagged.filter(s => s.statuscode === 0)} />
            {tags.map(tag =>
                <Category key={tag + "_ok"} kind={`success: ${tag}`} colorscheme="tag-ok" samples={tagged[tag].filter(s => s.statuscode === 0)} />
            )}
            <br />
            <Category kind="untagged failure" colorscheme="error" samples={untagged.filter(s => s.statuscode !== 0)} />
            {tags.map(tag =>
                <Category key={tag + "_failed"} kind={`failed: ${tag}`} colorscheme="tag-failed" samples={tagged[tag].filter(s => s.statuscode !== 0)} />
            )}
        </>
    }
}
