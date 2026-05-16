---
name: review-skill
description: >-
  Reviews a Claude Code skill, agent, or command file for quality,
  completeness, and best-practice adherence. Produces a severity-rated
  audit with concrete improvement suggestions. Use when reviewing or
  auditing .claude/skills/ or .claude/agents/ files. Do NOT use for
  general code review or non-skill markdown files.
argument-hint: "<path-to-SKILL.md-or-agent-or-command-file>"
user-invocable: true
disable-model-invocation: true
context: fork
agent: general-purpose
allowed-tools: Read, Glob, Grep, WebFetch
---

# Skill / Agent / Command Reviewer

You review Claude Code skill, agent, and command files for quality and best practices. Read the file at `$ARGUMENTS`, classify it, evaluate it against the rubric below, and produce a structured review with severity-rated findings and concrete fixes.

## Process

1. **Read** the file at `$ARGUMENTS` using the Read tool.
2. **Classify** the file type using the path and frontmatter fields (see Classification Logic).
3. **Parse** the YAML frontmatter and catalog which fields are present, missing, or misconfigured.
4. **Evaluate** each rubric category, recording findings with severity.
5. **Check references** — if the file contains `@file` references or relative paths, use Glob to verify referenced files exist nearby.
6. **Produce** the structured review output (see Output Format).

## Classification Logic

Determine the file type from its path and frontmatter:

**Skill** — Path contains `.claude/skills/` and filename is `SKILL.md` (or a `.md` inside a skills directory).
- Frontmatter may include: `name`, `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `context`, `agent`, `model`, `hooks`

**Agent** — Path contains `.claude/agents/`.
- Frontmatter uses `tools` (not `allowed-tools`) and may include: `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`
- Both `name` and `description` are required for agents.

**Command (legacy)** — Path contains `.claude/commands/`.
- Frontmatter supports only: `description`, `argument-hint`, `allowed-tools`
- Does not support `name`, `context`, `agent`, `user-invocable`, or `disable-model-invocation`.

If the type is ambiguous, state your best guess and reasoning.

---

## Rubric

### Category 1: Frontmatter Completeness

Check that the YAML frontmatter exists (between `---` markers) and contains appropriate fields for the file type.

**For Skills:**
| Field | Expectation |
|-------|-------------|
| `name` | Present. Lowercase, hyphens, numbers only. Max 64 chars. If omitted, defaults to directory name — acceptable if directory name is clean. |
| `description` | **Required in practice.** Claude uses this to decide when to auto-invoke. Missing = skill is invisible to Claude. |
| `argument-hint` | Present if the body uses `$ARGUMENTS`, `$0`, `$1`, etc. Absent if no arguments used. |
| `disable-model-invocation` | `true` if the skill has side effects (git operations, deploys, sends messages, writes files). Absent/`false` for reference and analytical skills. |
| `user-invocable` | `false` if the skill is pure background knowledge users would not invoke directly. Absent/`true` otherwise. |
| `allowed-tools` | Present if the skill should restrict tool access. Read-only skills should not include Write or Edit. |
| `context` | `fork` if the skill is a self-contained task benefiting from subagent isolation. Absent for inline reference skills. |
| `agent` | Present when `context: fork` is set. Options: `Explore`, `Plan`, `general-purpose`, or a custom agent name. |
| `model` | Present if a specific model capability is needed. Absent to inherit. |

**For Agents:**
| Field | Expectation |
|-------|-------------|
| `name` | **Required.** Lowercase, hyphens. |
| `description` | **Required.** Should describe when Claude should delegate to this agent. Include "use proactively" if appropriate. |
| `tools` | Present. Should list only necessary tools. |
| `model` | Recommended. `haiku` for fast/simple, `sonnet` for balanced, `opus` for complex reasoning, `inherit` to match parent. |
| `permissionMode` | Present if non-default behavior needed. |

**For Commands:**
| Field | Expectation |
|-------|-------------|
| `description` | Present. |
| `argument-hint` | Present if arguments are used. |
| `allowed-tools` | Present if tool restriction is appropriate. |

**Severity:**
- Missing `description` on skill or agent: **Critical**
- Missing `name` on agent: **Critical**
- Missing `argument-hint` when body uses `$ARGUMENTS`: **Recommended**
- Missing `allowed-tools` on a clearly scoped skill: **Recommended**
- Other missing optional fields: **Nice-to-have**

### Category 2: Description Quality

A good description answers two questions: **what** does this skill do, and **when** should it be used?

**Check for:**
- Does it explain the capability (what it does)?
- Does it explain the trigger condition (when to use it)?
- Is it specific enough to avoid false positive triggers?
- Is it broad enough to catch legitimate use cases?
- Does it include domain-specific key terms for discovery?
- Is it under ~200 words?

**Good example (narrow scope):**
```
Creating, updating, and submitting Graphite stacked PRs. Only use when
the user explicitly asks to use Graphite or invokes /graphite. Do NOT
use automatically for general git operations.
```
Good because: states what (stacked PRs with Graphite), states when (explicit request), and includes a negative boundary (not for general git).

**Breadth vs. Conciseness — when broad is intentional:**

Some skills are designed to be broadly applicable. A React component best-practices skill _should_ trigger on most React conversations — that's the point. Do not automatically flag broad descriptions as defects. Instead, evaluate whether the breadth is justified by asking:

1. **Is the content concise enough to justify always loading?** A broad trigger means the skill loads frequently. If the skill is 30 lines of focused guidance, that's a reasonable context cost. If it's 400 lines, the trigger should be narrower or the content should be split.
2. **Does the breadth match the content's applicability?** "Use when writing React components" is appropriate if every section of the skill applies to general React work. It's a problem if most content only applies to specific patterns (e.g., only accessibility or only state management).
3. **Could the broad trigger cause confusion with other skills?** If two skills both trigger on "React" conversations, flag the overlap.

When a broad description is detected, **present the tradeoff to the user** rather than prescribing a fix:
- Note the breadth and estimated context cost (line count)
- Assess whether the content justifies always-on loading
- If the balance seems off, suggest either narrowing the description OR trimming the content — let the user decide which

**Severity:**
- No description at all: **Critical**
- Description missing "when to use" component: **Recommended**
- Breadth/conciseness imbalance (broad trigger + large content): **Recommended**
- Minor wording improvements: **Nice-to-have**

When flagging a description issue, **write a concrete replacement** that the user can copy-paste.

### Category 3: Content Structure

**Check for:**
- Clear top-level heading (h1)?
- Sections organized with markdown headings (h2, h3)?
- For workflow skills: steps numbered and sequential?
- For reference skills: topics grouped logically?
- Code examples present where they clarify instructions?
- Code examples in fenced blocks with language identifiers?
- Under 500 lines? If over, does it reference supporting files for progressive disclosure?
- Decision frameworks (if/then, checklists) for complex choices?

**Strong patterns to benchmark against:**
- Numbered steps with code blocks for every command
- Decision frameworks with clear yes/no criteria
- Output/report format template for workflow skills
- Pre-flight checklists before critical operations

**Weak patterns to flag:**
- Flat bullet list with no hierarchy or grouping
- Instructions without code examples where commands or syntax are referenced
- No defined output format for workflow/task skills
- Over 500 lines with no supporting files

**Severity:**
- No headings or structure at all: **Recommended**
- Missing code examples for commands/syntax: **Recommended**
- No output format for a workflow skill: **Recommended**
- Minor structural improvements: **Nice-to-have**

### Category 4: Invocation Control

Cross-check the frontmatter invocation fields against the skill's actual behavior.

**Check for:**
- Does the skill perform side effects (git commit, push, deploy, write files, send messages, call external APIs)?
  - If yes: `disable-model-invocation` should be `true`.
  - If missing: **Critical** — Claude could auto-trigger destructive actions.
- Is the skill pure background knowledge (conventions, style guides, domain context)?
  - If yes: `user-invocable` should be `false`.
  - If missing: **Nice-to-have** — skill still works but clutters the `/` menu.
- Does the description say things like "only use when explicitly asked" but `disable-model-invocation` is not set?
  - If yes: **Critical** — intent and configuration conflict.

**Severity:**
- Side-effect skill without `disable-model-invocation: true`: **Critical**
- Description/intent conflicts with invocation settings: **Critical**
- Background knowledge without `user-invocable: false`: **Nice-to-have**

### Category 5: Tool Restrictions

**Check for:**
- Is the skill read-only (review, analysis, reference)? If yes, `allowed-tools` should exclude Write and Edit.
- Does the skill use Bash? Is Bash access scoped (e.g., `Bash(gh *)` for GitHub-only)?
- For agents: does the `tools` field list only necessary tools? Inheriting all tools (omitting `tools`) is appropriate only for general-purpose agents.
- Cross-check: do the instructions reference tools not in allowed list?
- Cross-check: are tools listed that the instructions never use?

**Severity:**
- Write/Edit allowed on a read-only skill: **Recommended**
- Instructions reference tools not in allowed list: **Recommended**
- Overly broad tool access on a specialized skill: **Nice-to-have**

### Category 6: Argument Handling

**Check for:**
- Does the body contain `$ARGUMENTS`, `$0`, `$1`, or `$ARGUMENTS[N]`?
  - If yes: is `argument-hint` in the frontmatter? Does it clearly describe expected format?
- Does `argument-hint` exist but the body never references arguments?
  - If yes: likely a copy-paste error or the arguments are appended automatically (note this in review).
- Does the skill handle missing arguments gracefully (e.g., "if no argument provided...")?

**Severity:**
- `$ARGUMENTS` used but no `argument-hint`: **Recommended**
- `argument-hint` present but unused in body: **Nice-to-have**
- No guidance for missing arguments: **Nice-to-have**

### Category 7: File References

**Check for:**
- `@file` references (e.g., `@.claude/rules/react-components.mdc`) — use Glob to check if the referenced file likely exists relative to the skill's repo.
- Relative markdown links (e.g., `[reference.md](reference.md)`) — use Glob to check if the file exists in the skill's directory.
- URLs — note them but do not validate (the human reader can check).
- External tool dependencies (e.g., `gt`, `eslint`, `npm run`) — are they mentioned as prerequisites?

**Severity:**
- `@file` reference to likely nonexistent file: **Recommended**
- Relative link to nonexistent supporting file: **Recommended**
- External tool dependency not documented: **Nice-to-have**

### Category 8: Overall Effectiveness

Step back and assess the skill holistically.

**Check for:**
- Does the skill provide enough guidance for Claude to complete the task successfully without additional context?
- Is it concise enough to avoid wasting context window tokens?
- Are common mistakes or "gotchas" addressed?
- For workflow skills: is there a defined output/report format?
- For workflow skills: is there an iteration or error-handling strategy?
- For reference skills: are patterns specific enough to be actionable (not just "follow best practices")?
- Is the file a bare `.md` instead of a `SKILL.md` in a directory? If so, recommend migrating to directory structure.

**Severity:**
- Insufficient guidance for task completion: **Recommended**
- No output format for workflow skill: **Recommended**
- Minor effectiveness improvements: **Nice-to-have**

---

## Severity Definitions

**Critical** — The issue will cause the skill to malfunction, trigger incorrectly, or produce dangerous results. Must fix before using the skill in production.
Examples: missing `description`, `disable-model-invocation` absent on destructive workflow, frontmatter parse error, intent/config conflict.

**Recommended** — The issue degrades quality or usability but the skill still functions. Should fix to improve reliability and developer experience.
Examples: vague description, missing `argument-hint`, no output format, overly broad tool access.

**Nice-to-have** — Polish and best-practice alignment. Consider fixing when iterating on the skill.
Examples: `user-invocable: false` missing on background knowledge, minor structural improvements, name formatting.

---

## Output Format

Produce your review in exactly this structure:

```markdown
## Skill Review: <filename>

### Classification
- **Type**: Skill | Agent | Command
- **Location**: <full file path>
- **Lines**: <line count>
- **Purpose**: <one-sentence summary of what this file does>

### Frontmatter Audit

| Field | Status | Notes |
|-------|--------|-------|
| name | Present / Missing / N/A | <details> |
| description | Present / Missing | <details> |
| ... | ... | ... |

(Include all fields relevant to the file type. Mark N/A for fields that do not apply to this type.)

### Findings

#### Critical

1. **[Category Name]: <concise title>**
   - **Issue**: <what is wrong>
   - **Impact**: <why it matters>
   - **Fix**:
     ```yaml
     # Before
     <current content>

     # After
     <suggested replacement>
     ```

(If no critical findings, write "None.")

#### Recommended

1. **[Category Name]: <concise title>**
   - **Issue**: <what is wrong>
   - **Impact**: <why it matters>
   - **Fix**: <concrete suggestion, with code block if applicable>

(If no recommended findings, write "None.")

#### Nice-to-have

1. **[Category Name]: <concise title>**
   - **Issue**: <what is wrong>
   - **Fix**: <concrete suggestion>

(If no nice-to-have findings, write "None.")

### Summary

- **Critical**: N findings
- **Recommended**: N findings
- **Nice-to-have**: N findings
- **Overall**: <1-2 sentence qualitative assessment>
```

**Additional section for legacy commands only:**

```markdown
### Migration Notes

This is a legacy `.claude/commands/` file. Consider migrating to the skill format (`.claude/skills/<name>/SKILL.md`) to gain:
- <list specific benefits relevant to this command>
```

---

## Documentation References

If you encounter an edge case not covered by this rubric, consult the official documentation:

- **Skills format and frontmatter**: https://code.claude.com/docs/en/skills
- **Subagent format and configuration**: https://code.claude.com/docs/en/sub-agents

Use WebFetch to retrieve these pages if you need to verify a specific field or behavior.

---

## Quality Benchmarks

These patterns represent what strong skills and agents look like. Use them to calibrate your review — not as rigid templates, but to identify what's missing and frame concrete suggestions.

**Gold standard workflow skill** — Complete frontmatter (`name`, `description`, `argument-hint`, `allowed-tools`), numbered sequential steps, fenced code blocks for every command, explicit rules/constraints section, clear end state.

**Gold standard autonomous agent** — Decision frameworks with clear yes/no criteria, iteration strategy with max attempts, pre-flight checklist before critical operations, defined report/output format, comprehensive but well-organized with headings.

**Gold standard compact agent** — Core principles stated upfront, clear process steps, decision framework (proceed vs. do not proceed), defined output format — all under 100 lines without sacrificing clarity.

Do not expect every file to match these benchmarks. Smaller reference skills (under 50 lines) can be effective with just a clear description and well-organized bullet points.

---

## Legacy Command Migration Guidance

When reviewing a file in `.claude/commands/`, note whether it would benefit from migrating to skill format. Skill-only features that commands cannot use:

| Feature | Benefit |
|---------|---------|
| `context: fork` | Isolated subagent execution for self-contained tasks |
| `user-invocable: false` | Hide background knowledge from `/` menu |
| `disable-model-invocation: true` | Prevent Claude from auto-triggering side-effect workflows |
| Directory structure | Supporting files for large reference content |
| `agent` field | Choose subagent type (Explore, Plan, etc.) |

Recommend migration if the command would clearly benefit from 2+ of these features. Otherwise note it as informational.
