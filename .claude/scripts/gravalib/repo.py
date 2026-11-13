"""Repository layout and configuration."""

import hashlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from .md import parse_yaml


def find_root(start=None):
    p = Path(start or os.getcwd()).resolve()
    for d in [p, *p.parents]:
        if (d / "_gflow").is_dir() or (d / ".git").exists():
            return d
    return p


class Repo:
    def __init__(self, root=None):
        self.root = Path(root) if root else find_root()
        self.gflow = self.root / "_gflow"          # the workflow's memory, for agents
        self.docs = self.root / "docs"             # documentation for people
        self.prd = self.gflow / "prd"
        self.blocks = self.prd / "blocks"
        self.domain = self.prd / "domain"
        self.arch = self.prd / "architecture"
        self.apis = self.gflow / "apis"
        self.schemas = self.gflow / "db-schemas"
        self.flows = self.gflow / "flows"
        self.discovery = self.gflow / "discovery"
        self.references = self.gflow / "references"
        self.config_path = self.gflow / "project.yaml"
        self.reports = self.root / "reports"
        self._config = None

    @property
    def config(self):
        if self._config is None:
            p = self.config_path
            self._config = parse_yaml(p.read_text(encoding="utf-8")) if p.exists() else {}
        return self._config

    def cfg(self, *keys, default=None):
        node = self.config
        for k in keys:
            if not isinstance(node, dict) or k not in node:
                return default
            node = node[k]
        return node if node is not None else default

    @property
    def tmp(self):
        """Working files (Jiku copies, drafts, MR text, logs): in the system's temp folder, never in the
        repo. One folder per repository; lost on reboot, by design."""
        tag = hashlib.sha1(str(self.root).encode()).hexdigest()[:8]
        d = Path(tempfile.gettempdir()) / "grava" / f"{self.root.name}-{tag}"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def integration_branch(self):
        return self.cfg("git", "integration_branch", default="dev")

    @property
    def production_branch(self):
        return self.cfg("git", "production_branch", default="main")

    def rel(self, p):
        try:
            return str(Path(p).resolve().relative_to(self.root))
        except ValueError:
            return str(p)

    def git(self, *args, check=True):
        r = subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True)
        if check and r.returncode != 0:
            die(f"git {' '.join(args)} falló: {r.stderr.strip()}")
        return r.stdout.strip()


def die(msg, code=2):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)
