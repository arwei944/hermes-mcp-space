#!/bin/bash
# ============================================================
# Hermes Agent MCP Space - 标准发布脚本
# 用法: bash scripts/release.sh "v1.8.0" "版本标题" "变更1" "变更2" ...
# 示例: bash scripts/release.sh "v1.8.0" "新功能" "添加了XX" "修复了YY"
#
# 自动同步三处:
#   1. GitHub: git tag + push + GitHub Release
#   2. HF Spaces: git push 触发自动部署
#   3. 关于页面: CHANGELOG 数组新增版本记录
# ============================================================

set -e

VERSION="$1"
TITLE="$2"
shift 2
CHANGES=("$@")

if [ -z "$VERSION" ] || [ -z "$TITLE" ]; then
    echo "❌ 用法: bash scripts/release.sh \"v1.8.0\" \"版本标题\" \"变更1\" \"变更2\" ..."
    exit 1
fi

# 验证版本号格式
if ! echo "$VERSION" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "❌ 版本号格式错误，应为 v1.0.0 格式"
    exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

DATE=$(date "+%Y-%m-%d %H:%M")
ABOUT_FILE="frontend/js/pages/about.js"

echo "========================================="
echo "  🚀 Hermes Agent 发布: $VERSION"
echo "  📅 日期: $DATE"
echo "  📝 标题: $TITLE"
echo "========================================="

# ---- Step 1: 更新关于页面 CHANGELOG ----
echo ""
echo "📌 Step 1/5: 更新关于页面 CHANGELOG..."

# 构建变更列表 JSON 数组
CHANGES_JSON=""
for change in "${CHANGES[@]}"; do
    if [ -n "$CHANGES_JSON" ]; then
        CHANGES_JSON="$CHANGES_JSON,"
    fi
    # 转义单引号
    escaped=$(echo "$change" | sed "s/'/\\\\'/g")
    CHANGES_JSON="${CHANGES_JSON}'${escaped}'"
done

# 在 CHANGELOG 数组开头插入新版本
python3 -c "
import re, sys

about_file = '$ABOUT_FILE'
version = '$VERSION'
date = '$DATE'
title = '''$TITLE'''
changes = [$CHANGES_JSON]

with open(about_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 构建新版本块
new_block = '        {\n'
new_block += f\"            version: '{version}',\n\"
new_block += f\"            date: '{date}',\n\"
new_block += f\"            title: '{title}',\n\"
new_block += '            changes: [\n'
for c in changes:
    new_block += f\"                '{c}',\n\"
new_block += '            ],\n'
new_block += '        },\n'

# 在 CHANGELOG 数组第一个 { 之前插入
pattern = r'(    const CHANGELOG = \[\n)(        \{)'
replacement = r'\1' + new_block + r'\2'
content = re.sub(pattern, replacement, content, count=1)

with open(about_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'  ✅ 已添加 {version} 到 CHANGELOG')
"

# ---- Step 2: Git commit + tag ----
echo ""
echo "📌 Step 2/5: Git commit + tag..."

git add -A
git commit -m "release: $VERSION - $TITLE" --allow-empty

# 检查 tag 是否已存在
if git tag -l "$VERSION" | grep -q "$VERSION"; then
    echo "  ⚠️ Tag $VERSION 已存在，跳过"
else
    git tag "$VERSION" -m "$VERSION: $TITLE"
    echo "  ✅ Tag $VERSION 已创建"
fi

# ---- Step 3: Push 到 GitHub + HF Spaces ----
echo ""
echo "📌 Step 3/5: Push 到 GitHub + HF Spaces..."

git push origin main 2>&1
git push origin "$VERSION" 2>&1
echo "  ✅ 代码和 Tag 已推送"

# ---- Step 4: 创建 GitHub Release ----
echo ""
echo "📌 Step 4/5: 创建 GitHub Release..."

# 获取 token
TOKEN=$(git remote get-url origin 2>/dev/null | grep -o 'ghp_[A-Za-z0-9_]*' | head -1)
if [ -z "$TOKEN" ]; then
    echo "  ⚠️ 未找到 GitHub token，跳过 Release 创建"
else
    # 构建 Release body
    BODY="## 🎉 $TITLE\n\n"
    for change in "${CHANGES[@]}"; do
        BODY="$BODY- $change\n"
    done

    # 转义 JSON
    BODY_JSON=$(echo -e "$BODY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")

    RESPONSE=$(curl -s -X POST "https://api.github.com/repos/arwei944/hermes-mcp-space/releases" \
        -H "Authorization: token $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"tag_name\": \"$VERSION\",
            \"name\": \"$VERSION - $TITLE\",
            \"body\": $BODY_JSON,
            \"draft\": false,
            \"prerelease\": false
        }")

    RELEASE_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('html_url',''))" 2>/dev/null)
    if [ -n "$RELEASE_URL" ]; then
        echo "  ✅ Release 已创建: $RELEASE_URL"
    else
        echo "  ⚠️ Release 创建失败（可能已存在）"
    fi
fi

# ---- Step 5: 验证 ----
echo ""
echo "📌 Step 5/5: 验证..."

echo "  Git tags: $(git tag -l --sort=-v:refname | head -3 | tr '\n' ', ')"
echo "  About CHANGELOG: $(grep -c \"version: '$VERSION'\" $ABOUT_FILE) 处引用"

echo ""
echo "========================================="
echo "  ✅ $VERSION 发布完成！"
echo "  📦 GitHub: https://github.com/arwei944/hermes-mcp-space/releases/tag/$VERSION"
echo "  🌐 HF Space: https://arwei944-hermes-mcp-space.hf.space/"
echo "  📋 关于页面: CHANGELOG 已更新"
echo "========================================="
