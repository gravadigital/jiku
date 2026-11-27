"""Install or update jiku flow into a repository's .claude/, touching only what belongs to jiku flow.

It always runs from the copy being installed (the clone), so an update uses the new version's rules.
What belongs to jiku flow is every file of the clone's .claude/ except the shared ones; the manifest
`.claude/.jflow-manifest` records them with their hash at install time, so an update knows which ones the
user modified and which ones a new version dropped. Everything else in .claude/ is the user's and is never
touched. Two files are shared and merged instead of copied:

- settings.json: jiku flow's permissions and hooks are added; the ones a previous version added and the new
  one no longer has are removed; the user's own entries stay.
- CLAUDE.md: jiku flow's text goes between two markers; the rest of the file is the user's.
"""

import hashlib
import json
import shutil
from pathlib import Path

MANIFEST = ".jflow-manifest"
SHARED = ("settings.json", "CLAUDE.md")
# Files of a product's .claude/ that are never shipped nor touched (local state).
LOCAL = (".jflow-version", ".jflow-manifest", "settings.local.json", "local-config.yaml",
         "agent-migrations-pending.md")
SKIP_PARTS = ("__pycache__",)
BEGIN, END = "<!-- jiku flow: begin (managed by jiku flow, do not edit) -->", "<!-- jiku flow: end -->"


def _sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def shipped(src):
    """{relative path: sha} of the files jiku flow ships, from the .claude/ of the copy being installed."""
    out = {}
    for p in sorted(src.rglob("*")):
        rel = p.relative_to(src).as_posix()
        if not p.is_file() or rel in SHARED or rel in LOCAL or any(x in p.parts for x in SKIP_PARTS):
            continue
        if rel.endswith((".bkp", ".new", ".pyc")):
            continue
        out[rel] = _sha(p)
    return out


def read_manifest(dst):
    p = dst / MANIFEST
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def plan(src, dst):
    """What an install or update would do. Returns a dict of lists:
    new (not there yet), update (ours, unmodified, changes), same, modified (ours, changed by the user;
    without a manifest: any file that differs), remove (dropped by the new version, unmodified),
    keep_removed (dropped by the new version but modified: left in place), clash (no manifest, a file of
    the user's with the same path as one of ours)."""
    files = shipped(src)
    man = read_manifest(dst)
    old = (man or {}).get("files", {})
    out = {k: [] for k in ("new", "update", "same", "modified", "remove", "keep_removed", "clash")}
    for rel, sha in files.items():
        d = dst / rel
        if not d.exists():
            out["new"].append(rel)
            continue
        cur = _sha(d)
        if cur == sha:
            out["same"].append(rel)
        elif man is None:
            out["clash"].append(rel)
        elif rel in old and cur == old[rel]:
            out["update"].append(rel)
        else:
            out["modified"].append(rel)
    for rel, sha in old.items():
        if rel in files:
            continue
        d = dst / rel
        if not d.exists():
            continue
        (out["remove"] if _sha(d) == sha else out["keep_removed"]).append(rel)
    return out


def _copy(src, dst, rel):
    d = dst / rel
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src / rel, d)


# ---------- shared files ----------

def _hook_commands(settings):
    """[(event, matcher, command)] of every command hook in a settings dict."""
    out = []
    for event, entries in (settings.get("hooks") or {}).items():
        for e in entries or []:
            for h in e.get("hooks") or []:
                if h.get("command"):
                    out.append((event, e.get("matcher", ""), h["command"]))
    return out


def merge_settings(src, dst, prev):
    """dst/settings.json with jiku flow's permissions and hooks; `prev` = what the previous install added.
    Returns (what jiku flow adds now, for the manifest)."""
    ours = json.loads((src / "settings.json").read_text(encoding="utf-8"))
    p = dst / "settings.json"
    cur = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    allow_ours = list((ours.get("permissions") or {}).get("allow") or [])
    hooks_ours = _hook_commands(ours)
    prev_allow = set((prev or {}).get("allow") or [])
    prev_hooks = {tuple(h) for h in (prev or {}).get("hooks") or []}
    # permissions: drop what a previous version added and this one no longer has, add ours
    perms = cur.setdefault("permissions", {})
    allow = [a for a in perms.get("allow") or [] if a not in prev_allow or a in allow_ours]
    allow += [a for a in allow_ours if a not in allow]
    perms["allow"] = allow
    # hooks: same, by (event, matcher, command)
    hooks = cur.setdefault("hooks", {})
    for event in list(hooks):
        kept = []
        for e in hooks[event] or []:
            hs = [h for h in e.get("hooks") or []
                  if (event, e.get("matcher", ""), h.get("command")) not in prev_hooks]
            if hs:
                kept.append({**e, "hooks": hs})
        hooks[event] = kept
    for event, matcher, command in hooks_ours:
        entries = hooks.setdefault(event, [])
        if any(h.get("command") == command for e in entries for h in e.get("hooks") or []):
            continue
        entry = next((e for e in entries if e.get("matcher", "") == matcher), None)
        if entry is None:
            entry = {"matcher": matcher, "hooks": []}
            entries.append(entry)
        entry["hooks"].append({"type": "command", "command": command})
    cur["hooks"] = {k: v for k, v in hooks.items() if v}
    p.write_text(json.dumps(cur, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"allow": allow_ours, "hooks": [list(h) for h in hooks_ours]}


def merge_claude_md(src, dst):
    """dst/CLAUDE.md with jiku flow's text between the markers; the rest stays as the user wrote it."""
    block = f"{BEGIN}\n{(src / 'CLAUDE.md').read_text(encoding='utf-8').strip()}\n{END}"
    p = dst / "CLAUDE.md"
    if not p.exists():
        p.write_text(block + "\n", encoding="utf-8")
        return
    text = p.read_text(encoding="utf-8")
    if BEGIN in text and END in text:
        a, b = text.index(BEGIN), text.index(END) + len(END)
        text = text[:a] + block + text[b:]
    else:
        text = text.rstrip() + "\n\n" + block + "\n"
    p.write_text(text, encoding="utf-8")


# ---------- install / update ----------

def run(src, dst, keep=(), dry=False):
    """Install or update. `keep`: modified files to leave as the user has them (the new version is saved
    next to each as `{file}.new`); the other modified files are replaced and the user's version saved as
    `{file}.bkp`. A clash (no manifest) is handled like a modified file. Returns (plan, notes)."""
    pl = plan(src, dst)
    notes = []
    if dry:
        return pl, notes
    dst.mkdir(parents=True, exist_ok=True)
    keep = set(keep)
    for rel in pl["new"] + pl["update"]:
        _copy(src, dst, rel)
    for rel in pl["modified"] + pl["clash"]:
        if rel in keep:
            shutil.copy2(src / rel, dst / f"{rel}.new")
            notes.append(f"kept {rel} (new version in {rel}.new)")
        else:
            shutil.copy2(dst / rel, dst / f"{rel}.bkp")
            _copy(src, dst, rel)
            notes.append(f"replaced {rel} (your version in {rel}.bkp)")
    for rel in pl["remove"]:
        (dst / rel).unlink()
        parent = (dst / rel).parent
        while parent != dst and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent
    for rel in pl["keep_removed"]:
        notes.append(f"left {rel}: the new version no longer has it, but you modified it")
    man = read_manifest(dst) or {}
    settings = merge_settings(src, dst, man.get("settings"))
    merge_claude_md(src, dst)
    files = shipped(src)
    # a kept file stays recorded with the shipped hash, so the next update sees it as modified again
    version = (src / "VERSION").read_text(encoding="utf-8").strip() if (src / "VERSION").exists() else ""
    (dst / MANIFEST).write_text(json.dumps({"version": version, "files": files, "settings": settings},
                                           indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return pl, notes
