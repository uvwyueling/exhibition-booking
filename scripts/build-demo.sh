#!/bin/sh
# 生成 demo/index.html —— 它就是 index.html 的逐字节副本。
#
# 为什么不改内容：页面靠 DEMO_MODE（按 location.pathname 判断 /demo/）自己切到假数据，
# 两份文件永远一致，改了首页不会忘记同步演示版。
#
# 改完 index.html 后跑一次：  npm run build:demo
set -eu
cd "$(dirname "$0")/.."
mkdir -p demo
cp index.html demo/index.html
echo "demo/index.html ← index.html  已同步"
