# Git Standards & Workflow

> **Version:** 1.0  
> **Applies to:** All contributors and AI agents

---

## Branching Strategy

| Branch | Purpose | Merges Into |
|--------|---------|-------------|
| `main` | Production-ready code | — |
| `develop` | Active development branch | `main` (via PR) |
| `feature/<name>` | New features | `develop` |
| `bugfix/<name>` | Non-urgent bug fixes | `develop` |
| `hotfix/<name>` | Urgent production fixes | `main` + `develop` |

### Rules
- Never push directly to `main`.
- All features branch from `develop`.
- Hotfixes branch from `main`, then merge back into both `main` and `develop`.

---

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructure (no new feature, no bug fix) |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process, tooling, dependency updates |

### Examples
```
feat(dashboard): add thermal analysis chart
fix(csv-parser): handle missing SOC column gracefully
docs: update project requirements for Phase 2
refactor(layout): convert dual-sidebar to single sidebar
```

---

## Pull Request Standards

1. **Target**: All PRs target `develop` unless it's a hotfix.
2. **Title**: Use conventional commit format.
3. **Description**: Explain what changed and why.
4. **Size**: Keep PRs focused — one feature/fix per PR.
5. **Review**: All PRs must be reviewed before merge.

---

## .gitignore Requirements

Ensure the following are always ignored:
- `node_modules/`
- `dist/`
- `__pycache__/`
- `*.db`
- `venv/`
- `.env`
