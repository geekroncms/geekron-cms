#!/bin/bash

# Geekron CMS 版本管理脚本
set -e

ACTION=${1:-show}
VERSION_TYPE=${2:-patch}

show_version() {
    current_version=$(grep '"version":' package.json | head -1 | cut -d'"' -f4)
    echo "📦 当前版本：v${current_version}"
}

bump_version() {
    current_version=$(grep '"version":' package.json | head -1 | cut -d'"' -f4)
    
    # 解析版本号
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case "$VERSION_TYPE" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo "❌ 未知版本类型：${VERSION_TYPE}"
            echo "用法：./scripts/version.sh bump [major|minor|patch]"
            exit 1
            ;;
    esac
    
    new_version="${major}.${minor}.${patch}"
    
    echo "📦 更新版本：v${current_version} -> v${new_version}"
    
    # 更新 package.json
    sed -i "s/\"version\": \"${current_version}\"/\"version\": \"${new_version}\"/" package.json
    
    # 创建 Git 提交和标签
    git add package.json
    git commit -m "chore: release v${new_version}"
    git tag "v${new_version}"
    
    echo "✅ 版本已更新到 v${new_version}"
    echo ""
    echo "推送命令："
    echo "  git push origin main --tags"
}

case "$ACTION" in
    show)
        show_version
        ;;
    bump)
        bump_version
        ;;
    *)
        echo "Geekron CMS 版本管理"
        echo "用法：./scripts/version.sh [show|bump] [major|minor|patch]"
        echo ""
        echo "示例:"
        echo "  ./scripts/version.sh show          # 显示当前版本"
        echo "  ./scripts/version.sh bump patch    # 增加补丁版本 (1.0.0 -> 1.0.1)"
        echo "  ./scripts/version.sh bump minor    # 增加次版本 (1.0.0 -> 1.1.0)"
        echo "  ./scripts/version.sh bump major    # 增加主版本 (1.0.0 -> 2.0.0)"
        ;;
esac
