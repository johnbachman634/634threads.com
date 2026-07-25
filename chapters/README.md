# chapters/

Published chapters only. One file per chapter, named `NN-slug.md`:

```
---
date: 2026-07-28
teaser: One-sentence description for search results and RSS.
---
# 1 · do-i-got-rhythm

*Thanksgiving, 2023*

Prose paragraphs separated by blank lines. *Italics* and **bold** work; `---` on its own line is a section break; `## ` starts a subhead.
```

The `# N · slug` heading is the canonical chapter identity (the build parses it for number and slug). Files that don't match `NN-slug.md` are ignored, including this README.
