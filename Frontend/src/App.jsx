import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Upload,
  X,
  BriefcaseBusiness,
  ListChecks,
} from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const TASKS = [
  {
    key: "job_analysis",
    title: "Job analysis",
    description: "Extract the role's requirements",
    icon: Target,
  },
  {
    key: "candidate_profile",
    title: "Resume match review",
    description: "Compare requirements with resume evidence",
    icon: ClipboardCheck,
  },
  {
    key: "tailored_resume",
    title: "Tailored resume",
    description: "Create a role-focused resume draft",
    icon: FileCheck2,
  },
  {
    key: "interview_guide",
    title: "Interview preparation",
    description: "Build practical, role-specific questions",
    icon: CircleHelp,
  },
];

function getResultText(result) {
  if (typeof result === "string") return result;
  if (typeof result?.text === "string") return result.text;
  return "";
}

function parseSSEBlock(block) {
  let event = "message";
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:"))
      dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

function InlineText({ text }) {
  const parts = String(text).split(
    /(<br\s*\/?>|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/gi,
  );

  return parts.map((part, index) => {
    if (/^<br\s*\/?>$/i.test(part)) {
      return <br key={index} />;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

/* ---------- Table helpers (presentation only) ---------- */

const BADGE = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  slate:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
};

function badgeFor(label, value) {
  if (!/status|difficulty|importance|^type$/i.test(label.trim())) return null;
  const v = String(value).replace(/\*/g, "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("not matching")) return BADGE.rose;
  if (v.includes("not evidenced")) return BADGE.slate;
  if (v.includes("unable")) return BADGE.violet;
  if (v.includes("partial")) return BADGE.amber;
  if (v === "match" || v.startsWith("match")) return BADGE.emerald;
  if (v.startsWith("beginner") || v === "low") return BADGE.emerald;
  if (v.startsWith("intermediate") || v.startsWith("medium")) return BADGE.amber;
  if (v.startsWith("advanced") || v === "high") return BADGE.rose;
  if (v === "required") return BADGE.violet;
  if (v === "preferred") return BADGE.sky;
  return null;
}

function CellValue({ label, value }) {
  const badge = badgeFor(label, value);
  if (badge) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge}`}
      >
        {String(value).replace(/\*/g, "").trim()}
      </span>
    );
  }
  if (String(value).includes("•")) {
    const items = String(value)
      .split("•")
      .map((item) => item.replace(/<br\s*\/?>/gi, " ").trim())
      .filter(Boolean);
    return (
      <ul className="list-disc space-y-1 pl-5 marker:text-violet-500">
        {items.map((item, i) => (
          <li key={i}>
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return <InlineText text={value} />;
}

function TableCards({ header, rows }) {
  const hasIndex = /^(#|no\.?|sr\.?)$/i.test(header[0].trim());
  const preferred = header.findIndex(
    (label, i) =>
      (!hasIndex || i > 0) &&
      /^(requirement|skill|question|item|name)/i.test(label.trim()),
  );
  const titleIdx = preferred >= 0 ? preferred : hasIndex ? 1 : 0;

  return (
    <div className="my-4 space-y-3">
      {rows.map((row, r) => {
        const number = hasIndex ? row[0] : String(r + 1);
        const title = row[titleIdx] || "—";
        const fields = header
          .map((label, i) => ({ label, value: row[i] || "—", i }))
          .filter((f) => f.i !== titleIdx && !(hasIndex && f.i === 0));
        const isShort = (f) =>
          f.value.length <= 40 && !String(f.value).includes("•");
        const chips = fields.filter(isShort);
        const blocks = fields.filter((f) => !isShort(f));

        return (
          <div
            key={r}
            className="row-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-violet-700 sm:p-5"
            style={{ animationDelay: `${Math.min(r, 12) * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                {number}
              </span>
              <div className="min-w-0 flex-1 font-semibold leading-6 text-slate-900 dark:text-slate-100">
                <InlineText text={title} />
              </div>
            </div>

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 pl-0 sm:pl-11">
                {chips.map((f) => (
                  <div
                    key={f.i}
                    className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <span className="font-medium uppercase tracking-wide text-slate-400">
                      {f.label}
                    </span>
                    <CellValue label={f.label} value={f.value} />
                  </div>
                ))}
              </div>
            )}

            {blocks.length > 0 && (
              <div className="mt-3 grid gap-3 sm:pl-11 md:grid-cols-2">
                {blocks.map((f) => (
                  <div
                    key={f.i}
                    className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
                  >
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      {f.label}
                    </p>
                    <div className="text-sm leading-6">
                      <CellValue label={f.label} value={f.value} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MarkdownContent({ content }) {
  const lines = useMemo(
    () =>
      String(content || "")
        .replace(/\r\n/g, "\n")
        .split("\n"),
    [content],
  );
  const nodes = [];
  let list = [];
  let table = [];

  const flushList = () => {
    if (!list.length) return;
    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        className="my-3 list-disc space-y-2 pl-5 marker:text-violet-500"
      >
        {list.map((line, i) => (
          <li key={i} className="pl-1 leading-7">
            <InlineText text={line} />
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  const flushTable = () => {
    if (!table.length) return;
    const rows = table
      .filter(
        (line) =>
          !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim()),
      )
      .map((line) =>
        line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
    if (rows.length) {
      if (rows[0].length >= 4) {
        nodes.push(
          <TableCards
            key={`table-${nodes.length}`}
            header={rows[0]}
            rows={rows.slice(1)}
          />,
        );
      } else {
        nodes.push(
          <div
            key={`table-${nodes.length}`}
            className="my-4 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-violet-50 text-violet-900 dark:bg-slate-800 dark:text-violet-200">
                <tr>
                  {rows[0].map((cell, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    >
                      {<InlineText text={cell} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-slate-200 align-top transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-violet-50/60 dark:border-slate-700 dark:odd:bg-transparent dark:even:bg-slate-800/30 dark:hover:bg-violet-950/20"
                  >
                    {rows[0].map((label, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 leading-6">
                        <CellValue
                          label={label}
                          value={row[cellIndex] || "—"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
    }
    table = [];
  };

  lines.forEach((original) => {
    const line = original.trim();

    if (line.startsWith("|") && line.split("|").length >= 3) {
      flushList();
      table.push(line);
      return;
    }

    flushTable();
    if (!line) {
      flushList();
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const className =
        level === 1
          ? "mb-3 mt-7 text-xl font-bold tracking-tight"
          : level === 2
            ? "mb-2 mt-6 text-lg font-semibold tracking-tight"
            : "mb-2 mt-4 text-base font-semibold";
      nodes.push(
        <h3 key={`h-${nodes.length}`} className={className}>
          <InlineText text={headingMatch[2]} />
        </h3>,
      );
      return;
    }
    if (/^---+$/.test(line)) {
      nodes.push(
        <hr
          key={`hr-${nodes.length}`}
          className="my-5 border-slate-200 dark:border-slate-700"
        />,
      );
      return;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      nodes.push(
        <div key={`num-${nodes.length}`} className="my-2 flex gap-3 leading-7">
          <span className="font-semibold text-violet-600 dark:text-violet-400">
            {numbered[1]}.
          </span>
          <div className="min-w-0">
            <InlineText text={numbered[2]} />
          </div>
        </div>,
      );
      return;
    }
    nodes.push(
      <p key={`p-${nodes.length}`} className="my-2 leading-7">
        <InlineText text={line} />
      </p>,
    );
  });

  flushList();
  flushTable();

  return (
    <div className="resume-preview min-w-0 break-words text-sm leading-7">
      {nodes.length ? (
        nodes
      ) : (
        <p className="text-slate-500">No content available yet.</p>
      )}
    </div>
  );
}

const CANDIDATE_SECTIONS = [
  {
    title: "Matching Skills and Requirements",
    key: "matching",
    icon: CheckCircle2,
    style: "emerald",
  },
  { title: "Partial Matches", key: "partial", icon: Activity, style: "amber" },
  {
    title: "Not Matching Requirements",
    key: "mismatch",
    icon: X,
    style: "rose",
  },
  {
    title: "Not Evidenced Requirements",
    key: "notEvidenced",
    icon: CircleHelp,
    style: "slate",
  },
  {
    title: "Unable to Assess",
    key: "unable",
    icon: CircleHelp,
    style: "violet",
  },
];

function getCandidateSections(text) {
  const result = {};
  let active = null;
  const headingMap = new Map(
    CANDIDATE_SECTIONS.map((section) => [
      section.title.toLowerCase(),
      section.key,
    ]),
  );
  const nonCategoryHeadings = [
    "candidate summary",
    "detailed skill assessments",
    "evidence-based strengths",
    "priority gaps",
    "overall assessment",
    "recommendation",
  ];
  for (const line of String(text || "").split(/\r?\n/)) {
    const cleaned = line
      .replace(/^\s*#+\s*/, "")
      .replace(/^\s*\*\*(.*?)\*\*\s*:?\s*$/, "$1")
      .replace(/^\s*\*\*(.*?)\*\*\s*$/, "$1")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
    if (headingMap.has(cleaned)) {
      active = headingMap.get(cleaned);
      result[active] = [];
      continue;
    }
    if (nonCategoryHeadings.includes(cleaned)) {
      active = null;
      continue;
    }
    if (active) result[active].push(line);
  }
  return CANDIDATE_SECTIONS.map((section) => ({
    ...section,
    content: (result[section.key] || []).join("\n").trim(),
  }));
}

function CandidateProfile({ text }) {
  const sections = getCandidateSections(text);
  if (!sections.some((section) => section.content))
    return <MarkdownContent content={text} />;

  const colors = {
    emerald:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25",
    amber:
      "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25",
    rose: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25",
    slate:
      "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/60",
    violet:
      "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/25",
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sections.map((section, i) => {
          const Icon = section.icon;
          const count = (
            section.content.match(/^\s*(?:[-*]|\d+[.)])\s+/gm) || []
          ).length;
          return (
            <div
              key={section.key}
              className={`lift anim-fade-up rounded-xl border p-4 ${colors[section.style]}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-2">
                <Icon size={17} />
                <span className="text-xs font-semibold leading-4">
                  {section.title}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {section.content ? Math.max(count, 1) : 0}
              </div>
              <p className="text-xs opacity-75">
                {section.content ? "item(s) reported" : "No items reported"}
              </p>
            </div>
          );
        })}
      </div>

      {sections.map((section) => {
        if (!section.content) return null;
        const Icon = section.icon;
        return (
          <section
            key={section.key}
            className={`rounded-2xl border p-4 sm:p-5 ${colors[section.style]}`}
          >
            <h3 className="flex items-center gap-2 font-semibold">
              <Icon size={18} />
              {section.title}
            </h3>
            <div className="mt-3 text-slate-800 dark:text-slate-200">
              <MarkdownContent content={section.content} />
            </div>
          </section>
        );
      })}

      <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold">
          View complete candidate assessment
          <ChevronDown
            size={17}
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <MarkdownContent content={text} />
        </div>
      </details>
    </div>
  );
}

function SectionCard({
  task,
  result,
  status,
  onDownload,
  downloading,
  delay = 0,
}) {
  const Icon = task.icon;
  const text = getResultText(result);
  const completed = status === "completed";
  const running = status === "running";

  return (
    <section
      id={`section-${task.key}`}
      className="anim-fade-up scroll-mt-40 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/70 to-transparent px-5 py-4 dark:border-slate-800 dark:from-violet-950/20 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Icon size={21} />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight">{task.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {completed
                ? "Result ready"
                : running
                  ? "Working on this section…"
                  : task.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <span className="pop-in inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check size={13} /> Ready
            </span>
          )}
          {((task.key === "tailored_resume" && completed) ||
            (task.key === "interview_guide" && completed)) && (
            <button
              type="button"
              onClick={() =>
                onDownload(
                  task.key === "tailored_resume" ? "resume" : "interview",
                )
              }
              disabled={Boolean(downloading)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {downloading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              PDF
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-7 sm:py-7">
        {running && !text && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <LoaderCircle
                size={18}
                className="animate-spin text-violet-600"
              />
              {task.description}…
            </div>
            <div className="relative h-3 w-3/4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="progress-fill h-full w-full" />
            </div>
            <div className="relative h-3 w-1/2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="progress-fill h-full w-full" />
            </div>
          </div>
        )}
        {text &&
          (task.key === "candidate_profile" ? (
            <CandidateProfile text={text} />
          ) : (
            <MarkdownContent content={text} />
          ))}
        {!text && !running && (
          <p className="text-sm text-slate-400">
            This section will appear when its agent finishes.
          </p>
        )}
      </div>
    </section>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("crew-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [results, setResults] = useState({});
  const [taskStatuses, setTaskStatuses] = useState({});
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [appStatus, setAppStatus] = useState("idle");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      window.localStorage.setItem("crew-theme", darkMode ? "dark" : "light");
    } catch {
      console.log("Unable to save theme preference to localStorage.");
    }
  }, [darkMode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const completedCount = TASKS.filter(
    (task) => taskStatuses[task.key] === "completed",
  ).length;

  function selectFile(file) {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please upload your resume as a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Your PDF must be smaller than 10 MB.");
      return;
    }
    setError("");
    setResumeFile(file);
    setResumeText("");
  }

  function resetForm() {
    abortRef.current?.abort();
    setJobDescription("");
    setJobUrl("");
    setResumeFile(null);
    setResumeText("");
    setResults({});
    setTaskStatuses({});
    setProgress(0);
    setCurrentStage("");
    setAppStatus("idle");
    setError("");
    setShowResults(false);
    setDownloading("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setError("");

    if (!jobDescription.trim() && !jobUrl.trim()) {
      setError("Add a job description or a job posting URL.");
      return;
    }
    if (!resumeFile && !resumeText.trim()) {
      setError("Upload your resume as a PDF before continuing.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAppStatus("running");
    setResults({});
    setTaskStatuses({});
    setProgress(0);
    setCurrentStage("Preparing your application…");
    setShowResults(true);

    try {
      let extractedText = resumeText.trim();
      if (!extractedText && resumeFile) {
        const formData = new FormData();
        formData.append("file", resumeFile);
        const extractResponse = await fetch(`${API_BASE}/api/extract-resume`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        const extractData = await extractResponse.json().catch(() => ({}));
        if (!extractResponse.ok)
          throw new Error(
            extractData.detail || "Could not extract text from your PDF.",
          );
        extractedText = String(
          extractData.text || extractData.resume_text || "",
        ).trim();
        if (!extractedText)
          throw new Error(
            "No readable resume text was found. Please try another PDF.",
          );
        setResumeText(extractedText);
      }

      const response = await fetch(`${API_BASE}/api/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jobDescription.trim(),
          job_url: jobUrl.trim(),
          resume_text: extractedText,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.detail || `Generation failed (${response.status}).`,
        );
      }
      if (!response.body)
        throw new Error("The server did not provide a streaming response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedCompleteEvent = false;

      function handleEvent(block) {
        const parsed = parseSSEBlock(block);
        if (!parsed) return;
        const { event, data } = parsed;

        if (event === "progress") {
          const task = TASKS.find((item) => item.key === data.stage);
          setCurrentStage(
            data.message || task?.description || "Processing your application…",
          );
          if (data.stage)
            setTaskStatuses((previous) => ({
              ...previous,
              [data.stage]:
                previous[data.stage] === "completed" ? "completed" : "running",
            }));
        } else if (event === "task_complete") {
          setResults((previous) => ({
            ...previous,
            [data.key]: { text: getResultText(data.result) },
          }));
          setTaskStatuses((previous) => ({
            ...previous,
            [data.key]: "completed",
          }));
          const index = TASKS.findIndex((item) => item.key === data.key);
          if (index >= 0)
            setProgress(Math.round(((index + 1) / TASKS.length) * 100));
          setCurrentStage(
            `${data.label || TASKS[index]?.title || "Section"} complete`,
          );
        } else if (event === "complete") {
          receivedCompleteEvent = true;
          if (data.status === "success") {
            setAppStatus("success");
            setProgress(100);
            setCurrentStage(
              data.message || "All application sections are ready.",
            );
          } else {
            setAppStatus("error");
            setError(data.message || "The workflow did not finish.");
          }
        } else if (event === "error") {
          setAppStatus("error");
          setError(data.message || "An agent failed during processing.");
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        blocks.forEach(handleEvent);
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);

      if (!receivedCompleteEvent) {
        setAppStatus("error");
        setError(
          "The stream ended before the server confirmed that all agents completed. Please try again.",
        );
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setAppStatus("error");
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  async function downloadPdf(kind) {
    const isResume = kind === "resume";
    const text = getResultText(
      results[isResume ? "tailored_resume" : "interview_guide"],
    );
    if (!text.trim()) {
      setError("There is no completed content to download yet.");
      return;
    }
    setDownloading(kind);
    setError("");
    try {
      const endpoint = isResume
        ? "/api/pdf/resume"
        : "/api/pdf/interview-guide";
      const body = isResume ? { resume_text: text } : { interview_guide: text };
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "PDF generation failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = isResume
        ? "CREW-AI-Tailored-Resume.pdf"
        : "CREW-AI-Interview-Guide.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "Unable to download the PDF.");
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#080b16] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-[#080b16]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <a
            href="#"
            className="flex items-center gap-3"
            aria-label="CREW-AI home"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 transition-transform hover:rotate-6 hover:scale-105">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">
                CAREER<span className="text-violet-600">-CREWAI</span>
              </div>
              <div className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
                JOB APPLICATION STUDIO
              </div>
            </div>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 sm:flex">
              <ShieldCheck size={14} /> Evidence-focused
            </span>
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 transition hover:rotate-12 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ---------- Hero ---------- */}
        <section className="hero-bg anim-fade-up relative overflow-hidden rounded-4xl bg-linear-to-br from-[#4f35c9] via-violet-700 to-indigo-800 px-6 py-10 text-center text-white shadow-xl shadow-violet-950/10 sm:px-10 sm:py-14">
          <div className="anim-float pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="anim-float-slow pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="anim-spin-slow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-dashed border-white/20" />
          <div className="anim-spin-slow pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-white/10" />

          <div className="relative mx-auto max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur">
              <Sparkles size={14} /> Your AI-powered job search workspace
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Apply with clarity.
              <br /> Prepare with confidence.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-violet-100 sm:text-base">
              Turn a job posting and your existing resume into an
              evidence-based skill review, a tailored resume draft, and
              practical interview preparation.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-violet-100 sm:text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} /> Skill-by-skill comparison
              </span>
              <span className="flex items-center gap-2">
                <FileText size={16} /> Downloadable PDF drafts
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} /> No invented resume claims
              </span>
            </div>
          </div>

          <div className="relative mx-auto mt-10 grid max-w-4xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {TASKS.map((task, index) => {
              const Icon = task.icon;
              return (
                <div
                  key={task.key}
                  className="lift anim-fade-up flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm"
                  style={{ animationDelay: `${250 + index * 120}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-200">
                      Step {index + 1}
                    </p>
                    <p className="text-sm font-semibold leading-5">
                      {task.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Input form ---------- */}
        <section
          className="anim-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          style={{ animationDelay: "120ms" }}
        >
          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <BriefcaseBusiness size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Build your application
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Start with the role and your resume
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6 p-5 sm:p-8">
            <div>
              <label
                htmlFor="job-description"
                className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold"
              >
                <span>Job description</span>
                <span className="text-xs font-normal text-slate-400">
                  Paste text
                </span>
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={7}
                maxLength={50000}
                placeholder="Paste responsibilities, required skills, experience, and qualifications…"
                className="form-control w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
              />
              <div className="mt-1.5 flex justify-between gap-2 text-xs text-slate-400">
                <span>Use the full job posting for best results.</span>
                <span className="shrink-0 tabular-nums">
                  {jobDescription.length.toLocaleString()}/50k
                </span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="job-url"
                  className="mb-2 block text-sm font-semibold"
                >
                  Job posting URL{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </label>
                <input
                  id="job-url"
                  type="url"
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                  maxLength={2048}
                  placeholder="https://company.com/jobs/role"
                  className="form-control w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                />
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  If you paste the description above, the URL is optional. URL
                  retrieval depends on backend tools.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Your resume <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(event) => selectFile(event.target.files?.[0])}
                />
                {resumeFile ? (
                  <div className="pop-in flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 dark:bg-slate-900 dark:text-emerald-300">
                      <FileCheck2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                        {resumeFile.name}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                        {(resumeFile.size / 1024).toFixed(1)} KB · PDF
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResumeFile(null);
                        setResumeText("");
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      aria-label="Remove resume"
                      className="rounded-lg p-2 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    >
                      <X size={17} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      selectFile(event.dataTransfer.files?.[0]);
                    }}
                    className={`group flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${dragging ? "scale-[1.02] border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-slate-300 hover:border-violet-400 hover:bg-violet-50/50 dark:border-slate-700 dark:hover:bg-violet-950/20"}`}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition-transform group-hover:-translate-y-1 dark:bg-violet-950 dark:text-violet-300">
                      <Upload size={22} />
                    </div>
                    <span className="text-sm font-semibold">
                      Click or drop your resume here
                    </span>
                    <span className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      PDF only · Maximum 10 MB
                    </span>
                  </button>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Text is extracted from your PDF. Scanned PDFs may need OCR
                  before they can be read.
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="pop-in flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">{error}</div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                  className="shrink-0 rounded p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={appStatus === "running"}
                className="btn-glow flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-violet-600/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {appStatus === "running" ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />{" "}
                    Analyzing your application…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Analyze my application{" "}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              {(appStatus === "success" || appStatus === "error") && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="pop-in flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-4 text-sm font-semibold transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <RotateCcw size={16} /> Start a new analysis
                </button>
              )}
            </div>
            <p className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              Review all AI-generated content before using it. Skills are
              assessed from the evidence provided, not independently verified.
            </p>
          </form>
        </section>

        {/* ---------- Results ---------- */}
        {!showResults && (
          <div
            className="anim-fade-up rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-10 sm:py-14"
            style={{ animationDelay: "220ms" }}
          >
            <div className="anim-float mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <ListChecks size={29} />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight">
              Your results will appear here
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
              Submit the job details and your resume to start the four-stage
              workflow. Results arrive as each agent finishes.
            </p>
            <div className="mx-auto mt-8 grid max-w-4xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {TASKS.map((task, index) => {
                const Icon = task.icon;
                return (
                  <div
                    key={task.key}
                    className="lift flex items-start gap-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {task.description}
                      </p>
                    </div>
                    <span className="ml-auto text-xs font-semibold text-slate-400">
                      0{index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showResults && (
          <>
            <div className="anim-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity
                      size={19}
                      className="text-violet-600 dark:text-violet-400"
                    />
                    <h2 className="font-bold tracking-tight">
                      Workflow progress
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {appStatus === "success"
                      ? "All four agents have finished."
                      : appStatus === "error"
                        ? "The workflow stopped before completion."
                        : currentStage || "Preparing your application…"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold tabular-nums">
                    {progress}%
                  </div>
                  <div className="text-xs text-slate-500">
                    {completedCount} of 4 complete
                  </div>
                </div>
              </div>
              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Analysis progress"
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-700 ${appStatus === "running" ? "progress-fill" : ""}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TASKS.map((task, index) => {
                  const Icon = task.icon;
                  const status = taskStatuses[task.key] || "pending";
                  const done = status === "completed";
                  const running = status === "running";
                  return (
                    <div
                      key={task.key}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors duration-500 ${done ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : running ? "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/20" : "border-slate-100 dark:border-slate-800"}`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? "pop-in bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : running ? "pulse-ring bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}
                      >
                        {done ? (
                          <Check size={18} />
                        ) : running ? (
                          <LoaderCircle size={18} className="animate-spin" />
                        ) : (
                          <Icon size={18} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{task.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {done
                            ? "Completed"
                            : running
                              ? "In progress"
                              : `Step ${index + 1}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {appStatus === "success" && (
              <div className="pop-in flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Your results are ready
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                    Review each section. Confirm that every resume claim is
                    accurate before submitting it to an employer.
                  </p>
                </div>
              </div>
            )}

            <nav
              aria-label="Jump to section"
              className="sticky top-[76px] z-20"
            >
              <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/85 p-2 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
                {TASKS.map((task) => {
                  const Icon = task.icon;
                  const done = taskStatuses[task.key] === "completed";
                  return (
                    <a
                      key={task.key}
                      href={`#section-${task.key}`}
                      className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                    >
                      <Icon size={15} />
                      {task.title}
                      {done && (
                        <Check
                          size={13}
                          className="text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </a>
                  );
                })}
              </div>
            </nav>

            {TASKS.map((task, index) => (
              <SectionCard
                key={task.key}
                task={task}
                result={results[task.key]}
                status={taskStatuses[task.key] || "pending"}
                onDownload={downloadPdf}
                downloading={downloading}
                delay={index * 90}
              />
            ))}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-violet-600"
                />
                <p>
                  <strong className="text-slate-700 dark:text-slate-200">
                    How to read the match review:
                  </strong>{" "}
                  “Match” means the supplied resume contains supporting
                  evidence; it does not independently verify proficiency. “Not
                  evidenced” means the resume does not establish the
                  requirement—it does not prove the candidate lacks the skill.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#080b16]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6 lg:px-8">
          <p>CREW-AI · Job Application Studio</p>
          <p>Built to support your preparation, not replace your judgment.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;