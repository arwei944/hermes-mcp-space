# -*- coding: utf-8 -*-
"""
github_operations - GitHub 仓库操作工具
通过 gh CLI 执行搜索仓库、搜索代码、列出 Issues、创建 Issue 等操作
"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="github_operations",
        description="GitHub repository operations using the gh CLI: search repos, search code, list issues, create issues.",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["search_repos", "search_code", "list_issues", "create_issue"],
                    "description": "GitHub action to perform",
                },
                "query": {
                    "type": "string",
                    "description": "Search query (for search_repos and search_code)",
                },
                "repo": {
                    "type": "string",
                    "description": "Repository in owner/repo format (for list_issues and create_issue)",
                },
                "title": {
                    "type": "string",
                    "description": "Issue title (for create_issue)",
                },
                "body": {
                    "type": "string",
                    "description": "Issue body content (for create_issue)",
                },
                "limit": {
                    "type": "number",
                    "description": "Maximum number of results (default: 20)",
                    "default": 20,
                },
            },
            "required": ["action"],
        },
        handler=handle,
        tags=["system", "github"],
    )


def _run_gh_command(cmd_args: list) -> dict:
    """Execute a gh CLI command and return parsed JSON output."""
    import subprocess
    import json
    import shutil

    if not shutil.which("gh"):
        raise RuntimeError("GitHub CLI (gh) is not installed or not in PATH")

    result = subprocess.run(
        cmd_args,
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.returncode != 0:
        stderr = result.stderr.strip()
        raise RuntimeError(f"gh CLI error: {stderr}")

    output = result.stdout.strip()
    if not output:
        return {}

    return json.loads(output)


def handle(args: dict) -> dict:
    try:
        action = args.get("action", "")
        query = args.get("query", "").strip()
        repo = args.get("repo", "").strip()
        title = args.get("title", "").strip()
        body = args.get("body", "").strip()
        limit = args.get("limit", 20)

        if not action:
            return error_response("Action is required")

        if action == "search_repos":
            if not query:
                return error_response("Query is required for search_repos")

            data = _run_gh_command([
                "gh", "search", "repos", query,
                "--limit", str(limit),
                "--json", "name,description,url,stargazersCount,language",
            ])
            return success_response(
                data=data,
                message=f"Found {len(data) if isinstance(data, list) else 'N/A'} repositories",
            )

        elif action == "search_code":
            if not query:
                return error_response("Query is required for search_code")

            data = _run_gh_command([
                "gh", "search", "code", query,
                "--limit", str(limit),
                "--json", "repository,path,textMatches",
            ])
            return success_response(
                data=data,
                message=f"Found {len(data) if isinstance(data, list) else 'N/A'} code results",
            )

        elif action == "list_issues":
            if not repo:
                return error_response("Repo (owner/repo) is required for list_issues")

            data = _run_gh_command([
                "gh", "issue", "list",
                "--repo", repo,
                "--limit", str(limit),
                "--json", "number,title,state,createdAt,labels",
            ])
            return success_response(
                data=data,
                message=f"Found {len(data) if isinstance(data, list) else 'N/A'} issues in {repo}",
            )

        elif action == "create_issue":
            if not repo:
                return error_response("Repo (owner/repo) is required for create_issue")
            if not title:
                return error_response("Title is required for create_issue")

            cmd_args = [
                "gh", "issue", "create",
                "--repo", repo,
                "--title", title,
            ]
            if body:
                cmd_args.extend(["--body", body])

            result = _run_gh_command(cmd_args)
            return success_response(
                data=result,
                message=f"Issue created in {repo}",
            )

        else:
            return error_response(
                f"Unknown action: {action}. Use: search_repos, search_code, list_issues, create_issue"
            )

    except RuntimeError as e:
        return error_response(str(e))
    except Exception as e:
        return error_response(str(e))
