# -*- coding: utf-8 -*-
"""
github_client - GitHub CLI 封装服务
通过 subprocess 调用 gh CLI，提供 search_repos, search_code, list_issues, create_issue 方法
"""

import subprocess
import json
import shutil
from typing import Optional, List, Dict, Any


class GitHubClient:
    """Wrapper around the GitHub CLI (gh)."""

    def __init__(self):
        self._gh_path: Optional[str] = None

    @property
    def gh_path(self) -> str:
        """Find the gh CLI binary."""
        if self._gh_path is None:
            path = shutil.which("gh")
            if not path:
                raise RuntimeError("GitHub CLI (gh) is not installed or not in PATH")
            self._gh_path = path
        return self._gh_path

    def _run(self, args: List[str], timeout: int = 60) -> Any:
        """
        Execute a gh CLI command and return parsed JSON output.

        Args:
            args: Command arguments (without 'gh' prefix).
            timeout: Command timeout in seconds.

        Returns:
            Parsed JSON output (dict or list).

        Raises:
            RuntimeError: If gh is not found or command fails.
            json.JSONDecodeError: If output is not valid JSON.
        """
        cmd = [self.gh_path] + args
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            stderr = result.stderr.strip()
            raise RuntimeError(f"gh CLI error: {stderr}")

        output = result.stdout.strip()
        if not output:
            return {}

        return json.loads(output)

    def search_repos(
        self,
        query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search GitHub repositories.

        Args:
            query: Search query string.
            limit: Maximum number of results.

        Returns:
            List of repository dicts with name, description, url, etc.
        """
        return self._run([
            "search", "repos", query,
            "--limit", str(limit),
            "--json", "name,description,url,stargazersCount,language",
        ])

    def search_code(
        self,
        query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search code across GitHub.

        Args:
            query: Search query string.
            limit: Maximum number of results.

        Returns:
            List of code result dicts with repository, path, textMatches.
        """
        return self._run([
            "search", "code", query,
            "--limit", str(limit),
            "--json", "repository,path,textMatches",
        ])

    def list_issues(
        self,
        repo: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        List issues in a repository.

        Args:
            repo: Repository in owner/repo format.
            limit: Maximum number of results.

        Returns:
            List of issue dicts with number, title, state, etc.
        """
        return self._run([
            "issue", "list",
            "--repo", repo,
            "--limit", str(limit),
            "--json", "number,title,state,createdAt,labels",
        ])

    def create_issue(
        self,
        repo: str,
        title: str,
        body: str = "",
    ) -> Dict[str, Any]:
        """
        Create an issue in a repository.

        Args:
            repo: Repository in owner/repo format.
            title: Issue title.
            body: Issue body content.

        Returns:
            Dict with created issue details.
        """
        args = [
            "issue", "create",
            "--repo", repo,
            "--title", title,
        ]
        if body:
            args.extend(["--body", body])
        return self._run(args)

    def is_available(self) -> bool:
        """Check if gh CLI is available."""
        try:
            _ = self.gh_path
            return True
        except RuntimeError:
            return False


# Module-level singleton
_client: Optional[GitHubClient] = None


def get_client() -> GitHubClient:
    """Get the global GitHubClient instance."""
    global _client
    if _client is None:
        _client = GitHubClient()
    return _client
