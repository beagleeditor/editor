import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type EditorProblem = {
  path: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: number;
  source?: string;
  code?: string;
};

type Props = {
  problems: EditorProblem[];
  onSelect: (problem: EditorProblem) => void;
  onClose: () => void;
};

export default function ProblemsPanel({ problems, onSelect, onClose }: Props) {
  const errors = problems.filter((problem) => problem.severity === 1).length;
  const warnings = problems.filter((problem) => problem.severity === 2).length;

  return (
    <section className="problems-panel" aria-label="Problems">
      <header className="bottom-panel-header">
        <div className="bottom-panel-tabs"><strong>Problems</strong><span className="panel-count">{problems.length}</span></div>
        <div className="problems-summary">
          <span><AlertCircle size={13} /> {errors}</span>
          <span><AlertTriangle size={13} /> {warnings}</span>
          <button className="panel-icon-button" onClick={onClose} title="Close panel" aria-label="Close panel"><X size={15} /></button>
        </div>
      </header>
      <div className="problems-list">
        {problems.length === 0 ? (
          <div className="panel-empty"><Info size={17} /><span>No problems detected in open files.</span></div>
        ) : problems.map((problem, index) => {
          const name = problem.path.split(/[/\\]/).pop() || problem.path;
          return <button className="problem-row" key={`${problem.path}:${problem.line}:${problem.column}:${problem.message}:${index}`} onClick={() => onSelect(problem)} title={`${problem.path}:${problem.line}:${problem.column}`}>
            {problem.severity === 1 ? <AlertCircle className="problem-error" size={15} /> : problem.severity === 2 ? <AlertTriangle className="problem-warning" size={15} /> : <Info className="problem-info" size={15} />}
            <span className="problem-message">{problem.message}<small>{problem.source || problem.code || "Language server"}</small></span>
            <span className="problem-location">{name} ({problem.line}, {problem.column})</span>
          </button>;
        })}
      </div>
    </section>
  );
}
