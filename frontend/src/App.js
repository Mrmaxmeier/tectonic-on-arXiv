import React, { Component, PureComponent } from 'react';
import './App.css';

const HOST = 'https://tt.ente.ninja'

// css/html adapted from
// https://github.com/rust-lang-nursery/crater
// https://crater-reports.s3.amazonaws.com/pr-59527/index.html

class SampleComparison extends PureComponent {
  render() {
    let resA = this.props.left.results
    let resB = this.props.right.results

    let files = Array.from(new Set(Object.keys(resA).concat(Object.keys(resB))))
    files.sort()

    let id = this.props.sample

    let ObjectLink = ({ id }) => id ? <code><a href={HOST + "/objects/" + id}>{id}</a></code> : <i>missing</i>
    let BuildInfo = ({ statuscode }) =>
      <span>
        <b className={statuscode === 0 ? "cr-test-pass" : "cr-error"}></b>
        <span>{statuscode === 0 ? "build succeded" : "build failed"}</span>
      </span>

    return (
      <>
        <div className="crate">
          <a href={"https://arxiv.org/abs/" + id} target="_blank" rel="noopener noreferrer">{id}</a>
          <BuildInfo {...this.props.left} />
          <BuildInfo {...this.props.right} />
        </div>
        {this.props.simple ? null :
          files.map(file => <div key={file} style={{ display: 'flex', padding: '0.4em' }}>
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
    let simple = this.props.samples.length > 50
    return (
      <div className="category">
        <div className={`header cc-${this.props.colorscheme} toggle`} onClick={_ => this.setState({ open: !this.state.open })}>
          {this.props.kind} ({this.props.samples.length})
          {simple && this.state.open ? " [infos collapsed]" : null}
        </div>
        <div className={this.state.open ? "crates" : "crates hidden"} id="crates-error">
          {this.state.open ? (
            this.props.samples.map(s => <SampleComparison key={s} sample={s} left={this.props.lefts[s]} right={this.props.rights[s]} simple={simple} />)
          ) : null}
        </div>
      </div>
    )
  }
}

class ReportComparison extends PureComponent {
  render() {
    let samples = this.props.left.samples.concat(this.props.right.samples)
      .map(s => s.sample)
    samples = Array.from(new Set(samples))
    samples.sort()
    let A = {}
    let B = {}
    for (let sample of this.props.left.samples)
      A[sample.sample] = sample.engines.tectonic
    for (let sample of this.props.right.samples)
      B[sample.sample] = sample.engines.tectonic

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
      <Category kind="missing" colorscheme="error" samples={missing} lefts={A} rights={B} />
      <Category kind="added" colorscheme="test-pass" samples={added} lefts={A} rights={B} />
    </>
  }
}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      left: null,
      right: null
    }

    function loadReport(resp) {
      let lines = resp.split('\n').filter(x => x.length).map(JSON.parse)
      let meta = lines.shift()
      return { meta, samples: lines }
    }

    let left = "master-v0.1.11-162-gd69f5ff.jsonl"
    let right = "master-v0.1.11-190-g476e780.jsonl"
    right = "utf8-stringpool-v0.1.9-53-gdcbdbfc-dirty.jsonl"

    fetch(HOST + "/reports/" + left)
      .then(res => res.text())
      .then(res => this.setState({ left: loadReport(res) }))

    fetch(HOST + "/reports/" + right)
      .then(res => res.text())
      .then(res => this.setState({ right: loadReport(res) }))
  }
  render() {
    const ReportMeta = ({ meta }) => <div>
      {meta
        ? <a href={"https://github.com/tectonic-typesetting/tectonic/commit/" + meta.commit}>{meta.name}</a>
        : <span>loading...</span>}
      <div className="flags"></div>
    </div>
    return (
      <div className="App">
        <header>
          <div className="navbar">
            <h1>
              Report for <b>pr-59527</b>
            </h1>
            <ul>
              <li>
                <a href="#/changes/" className="active">Changes</a>
              </li>
              <li>
                <a href="#/summary/">Summary</a>
              </li>
              <li>
                <a href="#/meta">Other Reports</a>
              </li>
            </ul>
            {this.state.left && this.state.right ?
              <div className="count">{Math.max(this.state.left.samples.length, this.state.right.samples.length)} papers built</div>
              : null}
          </div>
          <div className="toolchains">
            <div className="toolchain toolchain-start">
              <ReportMeta meta={this.state.left ? this.state.left.meta : null} />
            </div>
            <div className="arrow"></div>
            <div className="toolchain">
              <ReportMeta meta={this.state.right ? this.state.right.meta : null} />
            </div>
          </div>
        </header>
        {this.state.left && this.state.right ? <ReportComparison left={this.state.left} right={this.state.right} /> : null}
      </div>
    );
  }
}

export default App;
