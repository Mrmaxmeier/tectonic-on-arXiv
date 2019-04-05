import React, { Component, PureComponent } from 'react';
import { HashRouter as Router, Route, Link, NavLink } from "react-router-dom";
import './App.css';
import { ReportComparison } from './Comparison'
import { ReportSummary } from './Summary'

export const HOST = 'https://tt.ente.ninja'

// css/html adapted from
// https://github.com/rust-lang-nursery/crater
// https://crater-reports.s3.amazonaws.com/pr-59527/index.html


class Navbar extends PureComponent {
  render() {
    let { left, right, report } = this.props

    let samples = (left || { samples: [] }).samples.concat((right || { samples: [] }).samples).concat((report || { samples: [] }).samples).map(x => x.sample)
    samples = Array.from(new Set(samples))

    let reportName = right ? right.meta.name : (report ? report.meta.name : null)
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
            <NavLink to="/compare" activeClassName="active">Changes</NavLink>
          </li>
          <li>
            <NavLink to="/summary" activeClassName="active">Summary</NavLink>
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
