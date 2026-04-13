When doing bulk transforms across many files, read at least 5-8 representative files across the range *before* writing the transform script. 2-3 samples misses edge cases (e.g., fragments on same line as content, commented-out components, varying indentation).

**Why:** The App Router migration took 3 script passes because early samples didn't reveal structural variations. Each pass risked introducing new issues.

**How to apply:** Before any scripted bulk edit, do a structural survey first. Look for the variations, not just the common case.
