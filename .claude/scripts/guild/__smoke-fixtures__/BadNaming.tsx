// Smoke-test fixture for the antagonist evaluator panel.
//
// Intentionally violates naming conventions:
//  - exported abbreviation (Btn) → naming-abbreviation-export
//  - Hungarian-style variable (colorString) → naming-hungarian
//  - boolean prop named as noun (header) → naming-boolean-form
//
// Lives outside Biome's files.includes and not imported in the
// build graph. See ./README.md for the fixture convention.
// Authored in the Phase 2 D8 smoke test of the
// 2026-05-02-agent-guilds project.

interface BtnProps {
  label: string;
  header: boolean;
  onClick: () => void;
}

export default function Btn({ label, header, onClick }: BtnProps) {
  const colorString = header ? 'blue' : 'gray';
  return (
    <button type="button" onClick={onClick} style={{ color: colorString }}>
      {label}
    </button>
  );
}
