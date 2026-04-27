import type { AcademicLanguageSummary, Tier2WordUsage, TranscriptSegment } from "@coachline/shared";

// Curated subset of the Academic Word List (Coxhead 2000) — high-frequency
// Tier 2 words common across subject areas. Lowercase, base forms only.
const TIER2_WORDS = new Set([
  "analyze", "analyse", "approach", "area", "assess", "assume", "authority",
  "available", "benefit", "concept", "consist", "context", "contract", "create",
  "data", "define", "derive", "distribute", "economy", "environment", "establish",
  "estimate", "evaluate", "evidence", "export", "factor", "feature", "final",
  "focus", "function", "identify", "indicate", "interpret", "issue", "labor",
  "legal", "major", "method", "occur", "percent", "period", "policy", "principle",
  "procedure", "process", "require", "research", "respond", "role", "section",
  "significant", "similar", "source", "specific", "structure", "theory", "vary",
  "appropriate", "category", "complex", "component", "consequence", "constitute",
  "construct", "contribute", "coordinate", "criteria", "decade", "demonstrate",
  "document", "domain", "effect", "element", "energy", "equation", "equivalent",
  "exist", "formula", "foundation", "generate", "hypothesis", "impact", "implement",
  "implication", "individual", "influence", "initial", "instance", "integrate",
  "investigate", "justify", "layer", "mechanism", "minimum", "objective",
  "obtain", "participate", "perceive", "phase", "primary", "proportion",
  "reaction", "region", "regulate", "relate", "relevant", "rely", "represent",
  "require", "resource", "series", "shift", "significant", "strategy", "sufficient",
  "summarize", "support", "technical", "transfer", "transform", "contrast",
  "compare", "classify", "predict", "describe", "explain", "illustrate",
  "infer", "modify", "observe", "organize", "sequence", "synthesize",
  "vocabulary", "comprehension", "analysis", "synthesis", "inference",
  "argument", "claim", "cite", "evidence", "reasoning", "conclusion",
  "perspective", "viewpoint", "justify", "elaborate", "clarify",
  // domain-overlap Tier 2/3
  "denominator", "numerator", "equation", "variable", "coefficient",
  "hypothesis", "organism", "habitat", "ecosystem", "phenomenon",
  "democracy", "constitution", "revolution", "migration", "civilization",
  "protagonist", "antagonist", "narrative", "metaphor", "symbolism",
  "inference", "theme", "perspective", "genre", "fluency",
]);

// Patterns that suggest a teacher defined the preceding word in-context.
// Matches constructs like: "word — that's...", "word means...", "word, which is..."
const DEFINITION_PATTERNS = [
  /(\w+)\s*[—–]\s*(that'?s|meaning|this means|in other words|also known as|or)/i,
  /(\w+)\s+(means|is when|refers to|is defined as|is called)/i,
  /(\w+),?\s+which (is|means|refers to)/i,
];

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
}

export function computeAcademicLanguage(
  teacherSegments: TranscriptSegment[]
): AcademicLanguageSummary {
  if (teacherSegments.length === 0) {
    return { tier2Words: [], tier2Count: 0, definitionRate: null };
  }

  const fullText = teacherSegments.map((s) => s.text).join(" ");
  const tokens = tokenize(fullText);

  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (TIER2_WORDS.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    return { tier2Words: [], tier2Count: 0, definitionRate: null };
  }

  const definedWords = new Set<string>();
  for (const pattern of DEFINITION_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags + "g");
    while ((match = re.exec(fullText)) !== null) {
      const word = match[1]?.toLowerCase();
      if (word && TIER2_WORDS.has(word)) definedWords.add(word);
    }
  }

  const tier2Words: Tier2WordUsage[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count, definedInContext: definedWords.has(word) }));

  const definedCount = tier2Words.filter((w) => w.definedInContext).length;
  const definitionRate =
    tier2Words.length > 0 ? Math.round((definedCount / tier2Words.length) * 1000) / 1000 : null;

  return { tier2Words, tier2Count: tier2Words.length, definitionRate };
}
