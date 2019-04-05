import React, { Component, PureComponent } from 'react';
import { HashRouter as Router, Route, Link } from "react-router-dom";
import './App.css';

const HOST = 'https://tt.ente.ninja'

// css/html adapted from
// https://github.com/rust-lang-nursery/crater
// https://crater-reports.s3.amazonaws.com/pr-59527/index.html

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
      <Category kind="missing samples" colorscheme="error" samples={missing} lefts={A} rights={B} />
      <Category kind="new samples" colorscheme="test-pass" samples={added} lefts={A} rights={B} />
    </>
  }
}
class ReportSummary extends PureComponent {
  render() {
    let samples = this.props.report.samples
    let ok = []
    let failed = []
    let internalError = []
    let untagged = []
    let tagged = {}
    for (let sample of samples) {
      if (sample.statuscode === 0) {
        ok.push(sample.sample)
      } else if (sample.statuscode === 1) {
        failed.push(sample.sample)
      } else {
        internalError.push(sample.sample)
      }

      if (sample.tags && sample.tags.length) {
        for (let tag of sample.tags) {
          if (!tagged[tag])
            tagged[tag] = []
          tagged[tag].push(sample.sample)
        }
      } else {
        untagged.push(sample.sample)
      }
    }

    return <>
      TODO
      <Category kind="identical" colorscheme="test-pass" samples={[]} lefts={{}} rights={{}} />
    </>
  }
}



class Navbar extends PureComponent {
  render() {
    let { left, right, report } = this.props

    let samples = (left || { samples: [] }).samples.concat((right || { samples: [] }).samples).concat((report || { samples: [] }).samples).map(x => x.sample)
    samples = Array.from(new Set(samples))

    let reportName = right ? right.name : (report ? report.name : null)
    const ReportMeta = ({ meta }) => <div>
      {meta
        ? <a href={"https://github.com/tectonic-typesetting/tectonic/commit/" + meta.commit}>{meta.name}</a>
        : <span>loading...</span>}
      <div className="flags"></div>
    </div>
    return <header>
      <div className="navbar">
        <h1>
          {reportName ? <>Report for <b>{reportName}</b></> : "tectonic-on-arXiv"}
        </h1>
        <ul>
          <li>
            <Link to="/compare" className="active">Changes</Link>
          </li>
          <li>
            <Link to="/summary" activeClassName="active">Summary</Link>
          </li>
          <li>
            <a href="https://arxiv.org/help/bulk_data_s3">Dataset</a>
          </li>
        </ul>
        {samples.length ?
          <div className="count">{samples.length} papers built</div>
          : <div className="count" />}
      </div>
      {left === null || right === null || left || right ? (
        <div className="toolchains">
          <div className="toolchain toolchain-start">
            <ReportMeta meta={left && left.meta} />
          </div>
          <div className="arrow"></div>
          <div className="toolchain">
            <ReportMeta meta={right && right.meta} />
          </div>
        </div>
      ) : null}
    </header>
  }
}

class ReportSelector extends PureComponent {
  render() {
    let { link, title } = this.props
    return <>
      <h3>{title}</h3>
      {this.props.meta ? (
        <ul style={{ padding: 0 }}>
          {this.props.meta.reports.map(({ name }) => <li key={name}>
            <Link to={link + name}><code>{name}</code></Link>
          </li>)}
        </ul>
      ) : "loading..."}
    </>
  }
}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      meta: null,
      reports: {}
    }

    fetch(HOST + "/reports/meta.json")
      .then(res => res.json())
      .then(meta => {
        meta.reports.sort((a, b) => a.name > b.name ? -1 : (a.name < b.name ? 1 : 0))
        this.setState({ meta })
      })
  }

  getReport(name) {
    if (this.state.reports[name])
      return this.state.reports[name]
    fetch(HOST + "/reports/" + name + ".jsonl")
      .then(res => res.text())
      .then(res => {
        let lines = res.split('\n').filter(x => x.length).map(JSON.parse)
        let meta = lines.shift()
        let report = { meta, samples: lines }
        let reports = Object.assign({}, this.state.reports)
        reports[name] = report
        this.setState({ reports })
      })
    return null
  }

  render() {

    return (
      <div className="App">
        <Router>
          <div>
            <Route path="/" exact component={() => <Navbar />} />
            <Route path="/compare/:left/:right" component={({ match }) => {
              let left = this.getReport(match.params.left)
              let right = this.getReport(match.params.right)
              return <>
                <Navbar left={left} right={right} />
                {left && right ? <ReportComparison left={left} right={right} /> : null}
              </>
            }} />
            <Route path="/compare/" exact component={() => <>
              <Navbar />
              <ReportSelector link="/compare/" title="Select baseline" meta={this.state.meta} />
            </>} />
            <Route path="/compare/:left" exact component={({ match }) => <>
              <Navbar />
              <ReportSelector link={"/compare/" + match.params.left + "/"} title={`compare ${match.params.left} to`} meta={this.state.meta} />
            </>} />
            <Route path="/summary/:report" component={({ match }) => {
              let report = this.getReport(match.params.report)
              return <>
                <Navbar report={report} />
                {report ? <ReportSummary report={report} /> : null}
              </>
            }} />
            <Route path="/summary" exact component={() => <>
              <Navbar />
              <ReportSelector link="/summary/" title="Select report" meta={this.state.meta} />
            </>} />
          </div>
        </Router>
      </div>
    );
  }
}

export default App;
