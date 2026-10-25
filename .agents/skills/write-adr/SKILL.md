---
name: write-adr
description: Use when a change picks between alternatives (technology, data model, contract shape, process rule, scope cut) or when a human asks for a decision record. Writes an ADR in docs/adr following the lifecycle layout that pnpm verify:docs checks.
---

# write-adr

Decision records prove that the team evaluated alternatives instead of accepting the first
answer an AI produced. They are written in Chinese, live in `docs/adr/<status>/`, and are
validated by `scripts/verify-adr.mjs`.

## Layout

```
docs/adr/
  proposed/     reviewed before being built
  implemented/  decided and shipped; kept current with what actually shipped
  rejected/     kept while the rationale prevents a tempting mistake
```

File name: `yyyy-mm-dd-<topic-kebab>.md`, dated when first proposed. Moving a file
between folders is how status changes; the `Status:` line must match the folder.

## Required shape (checked by the gate)

```markdown
# ADR-NNNN: <标题>

Status: proposed | implemented | rejected
Date: yyyy-mm-dd
Related: REQ-xx / TASK-xx / 其他 ADR 的相对链接

## 问题
## 决定            (proposed 状态下写 "## 方案")
## 备选方案
## 后果
## 验证
```

`## 备选方案` is mandatory and must list at least one alternative with why it lost.
A decision recorded without what it beat invites re-litigation.

## Procedure

1. Check `docs/adr/**` for an existing record on the same topic; supersede it with a link
   rather than silently contradicting it.
2. Write the record in the folder that matches reality today. A decision already made and
   shipped starts in `implemented/`.
3. For records the course explicitly requires (such as 公共层归属), also answer:
   采用什么方案、考虑了什么、依据是什么、如何达成组内一致（会议日期、参与人）。
4. Run `pnpm verify:docs`.
5. Include the ADR in the same merge request as the code it governs.
