import { useState, useRef, useEffect, useCallback } from "react";

const CATEGORIES = {
  behavioral: "Behavioral / HR",
  automation: "Automation & Control Systems",
  hiring_manager: "Hiring Manager",
  custom: "Custom Interview",
};

const CATEGORY_META = {
  behavioral: { emoji: "🧠", color: "#3b82f6" },
  automation: { emoji: "⚙️", color: "#8b5cf6" },
  hiring_manager: { emoji: "👔", color: "#f59e0b" },
  custom: { emoji: "✨", color: "#10b981" },
};

const DEFAULT_BOT_INSTRUCTIONS = `Score each answer out of 10, highlight strengths and areas to improve, provide a sample strong answer, then ask the next question.`;

function buildBaseSystem(botInstructions) {
  return `You are a professional interview coach conducting a mock interview.

STRICT RULES:
- Maximum 6 questions total. Questions 1 through 5 are regular interview questions. Question 6 is ALWAYS exactly: "Do you have any questions for me?"
- Each user message will tell you the current question number. Use it to track progress carefully.
- After the user answers questions 1 through 5: give scored feedback, then ask the next question.
- After question 5 feedback, the NEXT QUESTION field must be: "Do you have any questions for me?"
- After the user answers question 6: do NOT score it. Warmly close the interview, congratulate them, and offer 1 to 2 final coaching tips.

COACHING STYLE (user-defined):
${botInstructions}

FORMAT for feedback after questions 1 through 5 (use EXACTLY this structure):
SCORE: [number]/10
STRENGTHS:
• [point]
• [point]
IMPROVEMENTS:
• [point]
• [point]
SAMPLE ANSWER:
[2-3 sentence example]
NEXT QUESTION:
[next question text]

When starting the interview, ask question 1 immediately with no preamble. Keep questions realistic and challenging.`;
}

function buildSystemPrompts(botInstructions) {
  const base = buildBaseSystem(botInstructions);
  return {
    behavioral: base + `\n\nThis is a Behavioral/HR interview. Ask classic behavioral questions using the STAR method (Situation, Task, Action, Result). Focus on teamwork, conflict resolution, leadership, adaptability, and communication.`,
    automation: base + `\n\nThis is an Automation & Control Systems engineering interview. Ask technical questions about PLCs, SCADA, HMI, PID controllers, industrial protocols (Modbus, EtherNet/IP, Profibus), safety systems (SIL, functional safety), instrumentation, loop tuning, and troubleshooting.`,
    hiring_manager: base + `\n\nThis is a Hiring Manager interview. Use these questions in order:
1. Tell me about yourself and why you are interested in this role.
2. What do you know about our company, and why do you want to work here specifically?
3. Walk me through your most relevant experience for this position.
4. What are your greatest professional strengths, and can you give a specific example?
5. Describe a challenging situation you faced at work and how you resolved it.
Then question 6 is: "Do you have any questions for me?"`,
  };
}

function buildCustomSystemPrompt(jobDescription, resume, botInstructions) {
  const base = buildBaseSystem(botInstructions);
  return base + `\n\nThis is a CUSTOM interview tailored specifically to the candidate's resume and the job description provided below.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume}

INSTRUCTIONS FOR CUSTOM INTERVIEW:
- Craft questions that directly reference specific skills, technologies, responsibilities, and requirements from the job description above.
- Reference specific experiences, roles, and achievements from the candidate's resume to ask targeted follow-up questions.
- Mix technical questions (based on required skills in the JD) with behavioral questions (based on the candidate's past experience).
- Point out any gaps between the resume and job requirements and probe those areas.
- Score answers in the context of what the specific role demands.
- In the SAMPLE ANSWER, tailor examples to the candidate's background and the role's requirements.
- STRICT: Only ask 5 questions (1-5), then question 6 must be "Do you have any questions for me?" — no exceptions.`;
}

function parseResponse(text) {
  if (text.includes("SCORE:")) {
    const scoreMatch = text.match(/SCORE:\s*(\d+)\/10/);
    const strengthsMatch = text.match(/STRENGTHS:([\s\S]*?)IMPROVEMENTS:/);
    const improvementsMatch = text.match(/IMPROVEMENTS:([\s\S]*?)SAMPLE ANSWER:/);
    const sampleMatch = text.match(/SAMPLE ANSWER:([\s\S]*?)NEXT QUESTION:/);
    const nextMatch = text.match(/NEXT QUESTION:([\s\S]*?)$/);
    return {
      type: "feedback",
      score: scoreMatch ? parseInt(scoreMatch[1]) : null,
      strengths: strengthsMatch ? strengthsMatch[1].trim() : "",
      improvements: improvementsMatch ? improvementsMatch[1].trim() : "",
      sample: sampleMatch ? sampleMatch[1].trim() : "",
      nextQuestion: nextMatch ? nextMatch[1].trim() : "",
    };
  }
  if (text.toLowerCase().includes("congratulations") || text.toLowerCase().includes("interview is complete") || text.toLowerCase().includes("well done") || text.toLowerCase().includes("that concludes")) {
    return { type: "wrapup", text };
  }
  return { type: "question", text };
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const pct = score / 10;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const color = score >= 8 ? "#4ade80" : score >= 6 ? "#facc15" : "#f87171";
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{score}</span>
        <span style={{ fontSize: 9, color: "#64748b", letterSpacing: 1 }}>/ 10</span>
      </div>
    </div>
  );
}

// ── Feedback Card ──────────────────────────────────────────────────────────────
function FeedbackCard({ parsed, isDark = true }) {
  return (
    <div style={{
      background: isDark ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "#ffffff",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      borderRadius: 16, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 16, animation: "slideIn 0.4s ease"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ScoreRing score={parsed.score} />
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: isDark ? "#64748b" : "#000000", textTransform: "uppercase", marginBottom: 4 }}>Interview Score</div>
          <div style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#475569" }}>
            {parsed.score >= 8 ? "Excellent response! 🎯" : parsed.score >= 6 ? "Good effort, room to grow." : "Needs more practice."}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: isDark ? "#052e16" : "#f0fdf4", border: isDark ? "1px solid #166534" : "1px solid #86efac", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: isDark ? "#4ade80" : "#16a34a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Strengths</div>
          <div style={{ fontSize: 12, color: isDark ? "#86efac" : "#15803d", lineHeight: 1.7 }}>{parsed.strengths}</div>
        </div>
        <div style={{ background: isDark ? "#450a0a" : "#fff1f2", border: isDark ? "1px solid #7f1d1d" : "1px solid #fca5a5", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: isDark ? "#f87171" : "#dc2626", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Improve</div>
          <div style={{ fontSize: 12, color: isDark ? "#fca5a5" : "#b91c1c", lineHeight: 1.7 }}>{parsed.improvements}</div>
        </div>
      </div>
      <div style={{ background: isDark ? "#0c1a2e" : "#eff6ff", border: isDark ? "1px solid #1e3a5f" : "1px solid #93c5fd", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ fontSize: 10, color: isDark ? "#60a5fa" : "#2563eb", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Sample Strong Answer</div>
        <div style={{ fontSize: 12, color: isDark ? "#93c5fd" : "#1d4ed8", lineHeight: 1.7, fontStyle: "italic" }}>{parsed.sample}</div>
      </div>
    </div>
  );
}

// ── Wrap Up Card ───────────────────────────────────────────────────────────────
function WrapUpCard({ text }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0d1f0d 0%, #1a2e1a 100%)",
      border: "1px solid #166534", borderRadius: 16, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 12, animation: "slideIn 0.4s ease"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28 }}>🏁</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>Interview Complete!</div>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>MOCK SESSION FINISHED</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#86efac", lineHeight: 1.8 }}>{text}</div>
    </div>
  );
}

// ── Waveform Bars ──────────────────────────────────────────────────────────────
function WaveformBars() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 18 }}>
      {[0.6, 1.0, 0.7, 0.9, 0.5].map((delay, i) => (
        <div key={i} style={{ width: 3, borderRadius: 2, background: "#f87171", animation: `wave ${delay}s ease ${i * 0.08}s infinite alternate` }} />
      ))}
    </div>
  );
}

// ── Customize Modal ────────────────────────────────────────────────────────────
function CustomizeModal({ instructions, onSave, onClose }) {
  const [draft, setDraft] = useState(instructions);
  const presets = [
    { label: "Strict & detailed", value: "Be strict and highly analytical. Give detailed, critical feedback. Push for concrete examples with measurable outcomes. Score conservatively." },
    { label: "Encouraging & warm", value: "Be warm and encouraging. Celebrate what the candidate does well before suggesting improvements. Keep feedback motivating and positive." },
    { label: "Fast-paced & concise", value: "Keep feedback brief — 1-2 sentences per point. Skip the sample answer unless the score is below 6. Move quickly to the next question." },
    { label: "Focus on storytelling", value: "Prioritize narrative structure. Evaluate whether answers follow a clear story arc (STAR format). Coach the candidate to be more specific and vivid." },
    { label: "Technical depth", value: "Probe technical depth aggressively. Ask follow-up questions if answers are vague. Score based on technical accuracy and specificity." },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "fadeIn 0.15s ease",
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid #334155", borderRadius: 20,
        width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto",
        padding: "28px 28px 24px", display: "flex", flexDirection: "column", gap: 20,
        animation: "slideIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>⚙️ Customize Coach Behavior</div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>Tell the coach how you want it to behave — tone, feedback style, focus areas.</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#475569", cursor: "pointer",
            fontSize: 20, lineHeight: 1, padding: "0 0 0 12px", flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Presets */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>Quick Presets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {presets.map(p => (
              <button key={p.label} onClick={() => setDraft(p.value)} style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid #334155",
                background: draft === p.value ? "rgba(99,102,241,0.15)" : "#1e293b",
                color: draft === p.value ? "#a5b4fc" : "#64748b",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
                borderColor: draft === p.value ? "#6366f1" : "#334155",
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Custom textarea */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>Custom Instructions</div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Describe how you want the coach to behave..."
            rows={5}
            style={{
              width: "100%", background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7,
              fontFamily: "inherit", padding: "12px 14px", resize: "vertical",
            }}
          />
          <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>
            {draft.length} characters · Applied to all interview categories
          </div>
        </div>

        {/* Reset + Save */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => setDraft(DEFAULT_BOT_INSTRUCTIONS)} style={{
            padding: "10px 18px", borderRadius: 10, border: "1px solid #334155",
            background: "transparent", color: "#64748b", fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
          }}>Reset to default</button>
          <button onClick={() => onSave(draft)} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 0 20px rgba(99,102,241,0.3)",
          }}>Save & Apply</button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Setup Screen ────────────────────────────────────────────────────────
function CustomSetupScreen({ onStart, onBack }) {
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");
  const [activeField, setActiveField] = useState(null);
  const canStart = jobDescription.trim().length > 50 && resume.trim().length > 50;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, padding: "32px 0 24px", maxWidth: 680, width: "100%", margin: "0 auto" }}>
      {/* Back button */}
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#475569", cursor: "pointer",
        fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 24,
        fontFamily: "inherit", padding: 0, alignSelf: "flex-start",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 2L4 7l5 5" />
        </svg>
        Back to menu
      </button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>✨</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>Custom Interview</div>
            <div style={{ fontSize: 12, color: "#475569" }}>Tailored questions from your JD & resume</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
          Paste the job description and your resume below. The AI will generate exactly 6 targeted interview questions — 5 role-specific questions plus a final "Do you have any questions for me?"
        </p>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {/* Job Description */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>
              📋 Job Description
            </label>
            <span style={{ fontSize: 11, color: jobDescription.length > 50 ? "#4ade80" : "#475569" }}>
              {jobDescription.length > 50 ? "✓ Ready" : `${Math.max(0, 51 - jobDescription.length)} more chars needed`}
            </span>
          </div>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${activeField === "jd" ? "#10b981" : jobDescription.trim().length > 50 ? "#166534" : "#1e293b"}`,
            transition: "border-color 0.2s",
          }}>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              onFocus={() => setActiveField("jd")}
              onBlur={() => setActiveField(null)}
              placeholder="Paste the full job description here — include required skills, responsibilities, qualifications, and any other details about the role..."
              rows={8}
              style={{
                width: "100%", background: "#0f172a", border: "none",
                color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, resize: "vertical",
                fontFamily: "inherit", padding: "14px 16px", display: "block",
              }}
            />
          </div>
        </div>

        {/* Resume */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>
              📄 Your Resume
            </label>
            <span style={{ fontSize: 11, color: resume.length > 50 ? "#4ade80" : "#475569" }}>
              {resume.length > 50 ? "✓ Ready" : `${Math.max(0, 51 - resume.length)} more chars needed`}
            </span>
          </div>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${activeField === "resume" ? "#10b981" : resume.trim().length > 50 ? "#166534" : "#1e293b"}`,
            transition: "border-color 0.2s",
          }}>
            <textarea
              value={resume}
              onChange={e => setResume(e.target.value)}
              onFocus={() => setActiveField("resume")}
              onBlur={() => setActiveField(null)}
              placeholder="Paste your resume here — work experience, education, skills, certifications, projects, and achievements..."
              rows={8}
              style={{
                width: "100%", background: "#0f172a", border: "none",
                color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, resize: "vertical",
                fontFamily: "inherit", padding: "14px 16px", display: "block",
              }}
            />
          </div>
        </div>
      </div>

      {canStart && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 10,
          background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)",
          fontSize: 12, color: "#6ee7b7", lineHeight: 1.7, animation: "slideIn 0.3s ease"
        }}>
          ✨ Ready! Your session will include 5 tailored questions + a final "Do you have any questions for me?" — scored against what the role actually requires.
        </div>
      )}

      <button
        onClick={() => onStart(jobDescription, resume)}
        disabled={!canStart}
        style={{
          marginTop: 20, padding: "15px", borderRadius: 12, border: "none",
          background: canStart ? "linear-gradient(135deg, #10b981, #059669)" : "#1e293b",
          color: canStart ? "#fff" : "#475569",
          fontSize: 15, fontWeight: 600, cursor: canStart ? "pointer" : "not-allowed",
          fontFamily: "inherit", transition: "all 0.2s",
          boxShadow: canStart ? "0 0 28px rgba(16,185,129,0.3)" : "none",
        }}
        onMouseEnter={e => { if (canStart) e.currentTarget.style.transform = "scale(1.01)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {canStart ? "Generate My Custom Interview →" : "Paste job description & resume to continue"}
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InterviewBot() {
  const [category, setCategory] = useState("behavioral");
  const [screen, setScreen] = useState("menu");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState(null);
  const [customContext, setCustomContext] = useState(null);
  const [botInstructions, setBotInstructions] = useState(DEFAULT_BOT_INSTRUCTIONS);
  const [showCustomize, setShowCustomize] = useState(false);
  const bottomRef = useRef(null);
  const historyRef = useRef([]);
  const recognitionRef = useRef(null);
  const baseTranscriptRef = useRef("");
  const systemPromptsRef = useRef(buildSystemPrompts(DEFAULT_BOT_INSTRUCTIONS));

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseTranscriptRef.current = input;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      let finalSeg = "", interimSeg = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalSeg += event.results[i][0].transcript + " ";
        else interimSeg += event.results[i][0].transcript;
      }
      if (finalSeg) baseTranscriptRef.current += finalSeg;
      setInput(baseTranscriptRef.current + interimSeg);
    };
    recognition.onerror = (e) => { if (e.error !== "aborted") setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
  }, [input]);

  const toggleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };

  function getSystemPrompt() {
    if (category === "custom" && customSystemPrompt) return customSystemPrompt;
    return systemPromptsRef.current[category] || systemPromptsRef.current.behavioral;
  }

  function handleSaveInstructions(newInstructions) {
    setBotInstructions(newInstructions);
    systemPromptsRef.current = buildSystemPrompts(newInstructions);
    setShowCustomize(false);
  }

  async function callGemini(userMessage) {
    // Embed the system prompt directly into the user message to avoid using systemInstruction
    const combined = `${getSystemPrompt()}\n\n${userMessage}`;
    historyRef.current = [...historyRef.current, { role: "user", parts: [{ text: combined }] }];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: historyRef.current,
        }),
      }
    );

    const data = await res.json();
    console.log("Gemini response:", data);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error getting response.";
    historyRef.current = [...historyRef.current, { role: "model", parts: [{ text }] }];
    return text;
  }

  async function startInterview() {
    if (isRecording) stopRecording();
    setScreen("interview");
    setLoading(true);
    setMessages([]);
    setInput("");
    setInterviewDone(false);
    baseTranscriptRef.current = "";
    historyRef.current = [];
    setQuestionCount(0);
    const catLabel = { behavioral: "Behavioral/HR", automation: "Automation & Control Systems engineering", hiring_manager: "Hiring Manager", custom: "Custom" }[category];
    const text = await callGemini(`Start my mock ${catLabel} interview. This is question 1 of 6. Ask me the first question now.`);
    setQuestionCount(1);
    setMessages([{ role: "assistant", text, parsed: parseResponse(text) }]);
    setLoading(false);
  }

  function handleCategorySelect(key) { setCategory(key); }

  function handleStartClick() {
    if (category === "custom") setScreen("custom-setup");
    else startInterview();
  }

  async function startInterviewWithPrompt(overridePrompt) {
    if (isRecording) stopRecording();
    setScreen("interview");
    setLoading(true);
    setMessages([]);
    setInput("");
    setInterviewDone(false);
    baseTranscriptRef.current = "";
    historyRef.current = [];
    setQuestionCount(0);
  
    const userMsg = {
      role: "user",
      parts: [{
        text: `${overridePrompt}\n\nStart my mock Custom interview. This is question 1 of 6. Ask me the first question now.`,
      }],
    };
    historyRef.current = [userMsg];
  
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: historyRef.current,
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";
    historyRef.current = [...historyRef.current, { role: "model", parts: [{ text }] }];
    setQuestionCount(1);
    setMessages([{ role: "assistant", text, parsed: parseResponse(text) }]);
    setLoading(false);
  }

  function handleCustomStartFull(jobDescription, resume) {
    const prompt = buildCustomSystemPrompt(jobDescription, resume, botInstructions);
    setCustomSystemPrompt(prompt);
    const firstLine = jobDescription.split("\n").find(l => l.trim().length > 0) || "Custom Role";
    setCustomContext({ label: firstLine.trim().slice(0, 60) });
    startInterviewWithPrompt(prompt);
  }

  async function sendAnswer() {
    if (!input.trim() || loading || interviewDone) return;
    if (isRecording) stopRecording();
    const userText = input.trim();
    setInput("");
    baseTranscriptRef.current = "";
    setMessages(m => [...m, { role: "user", text: userText }]);
    setLoading(true);
    const nextQ = questionCount + 1;
    let prompt;
    if (questionCount === 6) {
      prompt = `The candidate answered question 6 ("Do you have any questions for me?") with: "${userText}". The interview is now complete. Please close the session warmly.`;
    } else {
      prompt = `This was the candidate's answer to question ${questionCount} of 6. Answer: "${userText}". Please give feedback and ${nextQ <= 5 ? `ask question ${nextQ} of 6` : `then ask the final question: "Do you have any questions for me?" as question 6`}.`;
    }

    // Use custom prompt for custom category
    let responseText;
    if (category === "custom" && customSystemPrompt) {
      const combinedPrompt = `${customSystemPrompt}\n\n${prompt}`;
      const userMsg = { role: "user", parts: [{ text: combinedPrompt }] };
      historyRef.current = [...historyRef.current, userMsg];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: historyRef.current,
          }),
        }
      );
      const data = await res.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";
      historyRef.current = [...historyRef.current, { role: "model", parts: [{ text: responseText }] }];
    } else {
      responseText = await callGemini(prompt);
    }
    const parsed = parseResponse(responseText);

    setMessages(m => [...m, { role: "assistant", text: responseText, parsed }]);
    if (parsed.type === "wrapup" || questionCount === 6) {
      setInterviewDone(true);
    } else {
      setQuestionCount(nextQ);
    }
    setLoading(false);
  }

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); }
  };

  const goToMenu = () => {
    if (isRecording) stopRecording();
    setScreen("menu");
    setMessages([]);
    setInput("");
    setInterviewDone(false);
    historyRef.current = [];
    setQuestionCount(0);
    setCustomSystemPrompt(null);
    setCustomContext(null);
  };

  const meta = CATEGORY_META[category] || CATEGORY_META.behavioral;
  const isCustomized = botInstructions !== DEFAULT_BOT_INSTRUCTIONS;
  const isDark = theme === "dark";

  return (
    <div className="interview-body" style={{
      minHeight: "100vh",
      background: isDark ? "#020817" : "#f8fafc",
      color: isDark ? "#0f172a" : "#0f172a",
      fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes wave { 0% { height: 3px; } 100% { height: 18px; } }
        @keyframes micGlow { 0%,100% { box-shadow: 0 0 12px rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 24px rgba(239,68,68,0.9); } }
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.5); opacity: 0; } }
        textarea:focus { outline: none; }
        textarea::placeholder { color: #334155; }
        @supports (-webkit-touch-callout: none) { .interview-body { padding-bottom: env(safe-area-inset-bottom); } }
      `}</style>

      {/* Customize Modal */}
      {showCustomize && (
        <CustomizeModal
          instructions={botInstructions}
          onSave={handleSaveInstructions}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: isDark ? "#020817" : "#ffffff",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${meta.color}, #8b5cf6)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>{meta.emoji}</div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: isDark ? "#ffffff" : "#0f172a",
              }}
            >
              Interview Coach
            </div>
            <div
              style={{
                fontSize: 11,
                color: isDark ? "#94a3b8" : "#475569",
                letterSpacing: 1,
              }}
            >
              {screen === "custom-setup" ? "CUSTOM SETUP" : screen === "interview" ? CATEGORIES[category]?.toUpperCase() : "AI-POWERED PRACTICE"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {screen === "interview" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 4 }}>
                {[1,2,3,4,5,6].map(n => (
                  <div key={n} title={n === 6 ? "Do you have any questions?" : `Q${n}`} style={{
                    width: n === 6 ? 22 : 8, height: 8, borderRadius: 4,
                    background: n < questionCount ? meta.color : n === questionCount ? meta.color : "#1e293b",
                    opacity: n < questionCount ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "#fff", transition: "all 0.3s",
                  }}>{n === 6 ? "?" : ""}</div>
                ))}
              </div>
              <button onClick={goToMenu} style={{
                fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid #334155",
                background: "transparent", color: isDark ? "#94a3b8" : "#000000", cursor: "pointer",
                letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit",
              }}>← Menu</button>
              {!interviewDone && (
                <button onClick={() => category === "custom" ? setScreen("custom-setup") : startInterview()} style={{
                  fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid #334155",
                  background: "transparent", color: isDark ? "#94a3b8" : "#000000", cursor: "pointer",
                  letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit",
                }}>Restart</button>
              )}
            </>
          )}
          {screen === "menu" && (
            <>
            <button onClick={() => setShowCustomize(true)} style={{
              fontSize: 12, padding: "7px 14px", borderRadius: 9,
              border: `1px solid ${isCustomized ? "#6366f1" : "#334155"}`,
              background: isCustomized ? "rgba(99,102,241,0.1)" : "transparent",
              color: isCustomized ? "#a5b4fc" : "#64748b",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {isCustomized ? "Customized ✓" : "Customize"}
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                fontSize: 12,
                padding: "7px 14px",
                borderRadius: 9,
                border: "1px solid #334155",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isDark ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, width: "100%", margin: "0 auto", padding: "0 16px", overflowY: screen === "custom-setup" ? "auto" : undefined }}>

        {/* ── MENU ── */}
        {screen === "menu" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: "40px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "rgba(71, 85, 105, 1)", textTransform: "uppercase", marginBottom: 12 }}>Ready to practice?</div>
              <h1 style={{ fontSize: 36, fontWeight: 600, margin: 0, lineHeight: 1.2, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Your personal<br />
                <span style={{ fontWeight: 600, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  interview coach
                </span>
              </h1>
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {voiceSupported && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#60a5fa"
                  }}>🎙️ Voice enabled</div>
                )}
                <button onClick={() => setShowCustomize(true)} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: isCustomized ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.05)",
                  border: `1px solid ${isCustomized ? "#6366f1" : "rgba(99,102,241,0.25)"}`,
                  borderRadius: 20, padding: "5px 12px", fontSize: 12,
                  color: isCustomized ? "#a5b4fc" : "#6366f1",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}>
                  ⚙️ {isCustomized ? "Coach customized" : "Customize coach behavior"}
                </button>
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 560 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>Choose Category</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(CATEGORIES).map(([key, label]) => {
                  const m = CATEGORY_META[key];
                  const isCustomCat = key === "custom";
                  const isSelected = category === key;
                  // Slightly darker accent colors for light mode on specific categories
                  let accentColor = m.color;
                  if (!isDark) {
                    if (key === "hiring_manager") accentColor = "#d97706"; // darker amber
                    if (key === "custom") accentColor = "#059669"; // darker teal/green
                  }
                  return (
                    <button
                      key={key}
                      onClick={() => handleCategorySelect(key)}
                      style={{
                        padding: "16px 12px",
                        borderRadius: 12,
                        cursor: "pointer",
                        border: isSelected
                          ? (isDark ? `1px solid ${accentColor}` : `2px solid ${accentColor}`)
                          : "1px solid #e2e8f0",
                        background: isSelected
                          ? (isDark ? `${accentColor}15` : "#f8fafc")
                          : (isDark ? "#0f172a" : "#f8fafc"),
                        color: isSelected ? accentColor : "#64748b",
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        transition: "all 0.2s",
                        textAlign: "center",
                        fontFamily: "inherit",
                        position: "relative",
                      }}
                    >
                      {isCustomCat && (
                        <div style={{
                          position: "absolute", top: 8, right: 8, fontSize: 9,
                          background: "#10b981", color: "#fff", padding: "2px 6px",
                          borderRadius: 4, letterSpacing: 0.5, fontWeight: 600,
                        }}>NEW</div>
                      )}
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{m.emoji}</div>
                      <div>{label}</div>
                      {isCustomCat && <div style={{ fontSize: 11, color: category === key ? "#6ee7b7" : "#334155", marginTop: 4, fontWeight: 400 }}>JD + Resume tailored</div>}
                    </button>
                  );
                })}
              </div>
              {category === "behavioral" && (
                  <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(59, 130, 246, 0.07)", border: "1px solid rgba(59, 130, 246, 0.2)", fontSize: 12, color: "#3b82f6", lineHeight: 1.7, animation: "slideIn 0.2s ease" }}>
                  🧠Behavioral / HR interview. Ask classic behavioral questions using the STAR method (Situation, Task, Action, Result). Focus on teamwork, conflict resolution, leadership, adaptability, and communication.
                </div>
              )}
              {category === "automation" && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(139, 92, 246, 0.07)", border: "1px solid rgba(139, 92, 246, 0.2)", fontSize: 12, color: "#8b5cf6", lineHeight: 1.7, animation: "slideIn 0.2s ease" }}>
                  ⚙️ Automation & Control Systems interview. Ask technical questions about PLCs, SCADA, HMI, PID controllers, industrial protocols (Modbus, EtherNet/IP, Profibus), safety systems (SIL, functional safety), instrumentation, loop tuning, and troubleshooting.
                </div>
              )}
              {category === "custom" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: isDark
                      ? "rgba(16,185,129,0.07)"
                      : "rgba(5,150,105,0.06)",
                    border: isDark
                      ? "1px solid rgba(16,185,129,0.2)"
                      : "1px solid rgba(5,150,105,0.35)",
                    fontSize: 12,
                    color: isDark ? "#6ee7b7" : "#059669",
                    lineHeight: 1.7,
                    animation: "slideIn 0.2s ease",
                  }}
                >
                  ✨ Paste your job description and resume — the AI will craft exactly 6 questions specific to the role and your background.
                </div>
              )}
              {category === "hiring_manager" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: isDark
                      ? "rgba(245,158,11,0.07)"
                      : "rgba(217,119,6,0.06)",
                    border: isDark
                      ? "1px solid rgba(245,158,11,0.2)"
                      : "1px solid rgba(217,119,6,0.35)",
                    fontSize: 12,
                    color: isDark ? "#fbbf24" : "#d97706",
                    lineHeight: 1.7,
                    animation: "slideIn 0.2s ease",
                  }}
                >
                  👔 Simulates a real hiring manager: covers your background, motivations, experience, and cultural fit across 6 structured questions.
                </div>
              )}
            </div>

            <button onClick={handleStartClick} style={{
              padding: "14px 40px", borderRadius: 12,
              background: `linear-gradient(135deg, ${meta.color}, #8b5cf6)`,
              border: "none", color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: `0 0 32px ${meta.color}44`,
              transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {category === "custom" ? "Set Up Custom Interview →" : "Start Interview →"}
            </button>

            <div
              style={{
                marginTop: 28,
                width: "100%",
                textAlign: "center",
                fontSize: 12,
                color: isDark ? "#475569" : "rgba(71, 85, 105, 1)",
                letterSpacing: 0.3,
              }}
            >
              Last updated 2026-03-10 &copy; Web App created by Erin Ng
            </div>
          </div>
        )}

        {/* ── CUSTOM SETUP ── */}
        {screen === "custom-setup" && (
          <CustomSetupScreen
            onStart={handleCustomStartFull}
            onBack={() => setScreen("menu")}
          />
        )}

        {/* ── INTERVIEW ── */}
        {screen === "interview" && (
          <>
            {category === "custom" && customContext && (
              <div style={{ margin: "16px 0 0", padding: "8px 14px", borderRadius: 8, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)", fontSize: 12, color: "#6ee7b7", display: "flex", alignItems: "center", gap: 8 }}>
                <span>✨</span>
                <span style={{ color: "#475569" }}>Custom interview for:</span>
                <span style={{ fontStyle: "italic" }}>{customContext.label}</span>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 120px 0", display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ animation: "slideIn 0.35s ease" }}>
                  {msg.role === "user" ? (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ maxWidth: "78%", background: isDark ? "#0f172a" : "#DEEEFF", border: isDark ? "1px solid #1e293b" : "1px solid rgba(29, 78, 216, 0.45)", borderRadius: "16px 16px 4px 16px", padding: "14px 18px", fontSize: 14, lineHeight: 1.7, color: isDark ? "#cbd5e1" : "#1e293b" }}>{msg.text}</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 2, background: `linear-gradient(135deg, ${meta.color}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{meta.emoji}</div>
                      <div style={{ flex: 1 }}>
                        {msg.parsed?.type === "wrapup" ? (
                          <WrapUpCard text={msg.parsed.text || msg.text} />
                        ) : msg.parsed?.type === "feedback" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <FeedbackCard parsed={msg.parsed} isDark={isDark} />
                            {msg.parsed.nextQuestion && (
                              <div
                                style={{
                                  background: isDark ? "#0f172a" : "#ffffff",
                                  border: isDark ? "1px solid #1e293b" : "1px solid rgba(29, 78, 216, 0.45)",
                                  borderRadius: 14,
                                  padding: "16px 18px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 10,
                                    letterSpacing: 2,
                                    color: isDark ? "#475569" : "rgba(29, 78, 216, 0.8)",
                                    textTransform: "uppercase",
                                    marginBottom: 8,
                                  }}
                                >
                                  {msg.parsed.nextQuestion.toLowerCase().includes("do you have any questions") ? "Final Question" : "Next Question"}
                                </div>
                                <div style={{ fontSize: 14, lineHeight: 1.7, color: isDark ? "#cbd5e1" : "#0f172a" }}>{msg.parsed.nextQuestion}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              background: isDark ? "#0f172a" : "#ffffff",
                              border: isDark ? "1px solid #1e293b" : "1px solid rgba(29, 78, 216, 0.45)",
                              borderRadius: "4px 16px 16px 16px",
                              padding: "14px 18px",
                              fontSize: 14,
                              lineHeight: 1.7,
                              color: isDark ? "#cbd5e1" : "#1e293b",
                            }}
                          >
                            {msg.parsed?.text || msg.text}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${meta.color}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{meta.emoji}</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#475569", animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}

              {interviewDone && (
                <div style={{ textAlign: "center", padding: "16px 0", animation: "slideIn 0.4s ease" }}>
                  <button onClick={goToMenu} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #166534, #14532d)", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginRight: 10 }}>← Back to Menu</button>
                  <button onClick={() => category === "custom" ? setScreen("custom-setup") : startInterview()} style={{ padding: "12px 28px", borderRadius: 12, border: "1px solid #334155", background: "transparent", color: "#94a3b8", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Practice Again</button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {!interviewDone && (
              <div
                style={{
                  padding: "16px 0 24px",
                  borderTop: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
                  background: isDark ? "#020817" : "#f8fafc",
                  position: "sticky",
                  bottom: 0,
                  zIndex: 20,
                }}
              >
                {isRecording && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "8px 14px", animation: "slideIn 0.2s ease" }}>
                    <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ef4444", animation: "ripple 1.3s ease infinite" }} />
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ef4444" }} />
                    </div>
                    <WaveformBars />
                    <span style={{ fontSize: 12, color: "#f87171" }}>Listening… speak your answer</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Press ■ to stop</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-end",
                    background: isDark ? "#0f172a" : "#e2e8f0", // light gray container in light mode
                    border: `1px solid ${isRecording ? "rgba(239,68,68,0.35)" : (isDark ? "#1e293b" : "#cbd5e1")}`,
                    borderRadius: 14,
                    padding: "10px 10px 10px 16px",
                    transition: "border-color 0.25s",
                  }}
                >
                  <textarea
                    value={input}
                    onChange={e => { baseTranscriptRef.current = e.target.value; setInput(e.target.value); }}
                    onKeyDown={handleKey}
                    placeholder={isRecording ? "🎙️ Listening… speak now" : voiceSupported ? "Type or tap the mic to speak…" : "Type your answer… (Enter to send)"}
                    rows={3}
                    style={{
                      flex: 1,
                      background: isDark ? "transparent" : "#ffffff", // white input area in light mode
                      border: isDark ? "none" : "1px solid #cbd5e1",
                      borderRadius: isDark ? 0 : 10,
                      color: isDark ? "#e2e8f0" : "#000000",
                      fontSize: 14,
                      lineHeight: 1.6,
                      resize: "none",
                      fontFamily: "inherit",
                      padding: isDark ? 0 : "10px 12px",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    {voiceSupported && (
                      <button onClick={toggleRecording} disabled={loading} style={{
                        width: 40, height: 40, borderRadius: 10, border: "none",
                        background: isRecording
                          ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                          : (isDark ? "#1e293b" : "linear-gradient(135deg, #3b82f6, rgba(139, 92, 246, 1))"),
                        color: isRecording ? "#fff" : loading ? "#475569" : (isDark ? "#94a3b8" : "#ffffff"),
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s", animation: isRecording ? "micGlow 1.5s ease infinite" : "none",
                        boxShadow: isRecording ? "0 0 16px rgba(220,38,38,0.5)" : "none",
                      }}>
                        {isRecording
                          ? <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="1" y="1" width="11" height="11" rx="2" /></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>
                        }
                      </button>
                    )}
                    <button onClick={sendAnswer} disabled={!input.trim() || loading} style={{
                      width: 40, height: 40, borderRadius: 10, border: "none",
                      background: input.trim() && !loading
                        ? `linear-gradient(135deg, ${meta.color}, rgba(139, 92, 246, 1))`
                        : (isDark ? "#1e293b" : "#e2e8f0"),
                      color: input.trim() && !loading ? "#fff" : (isDark ? "#475569" : "#64748b"),
                      cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                      fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>↑</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 8, display: "flex", gap: 16, justifyContent: "center" }}>
                  <span>Shift+Enter for newline · Enter to submit</span>
                  {voiceSupported && <span>🎙️ Mic button to record voice</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
