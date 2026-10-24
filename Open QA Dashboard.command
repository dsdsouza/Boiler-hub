#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v pnpm >/dev/null 2>&1; then
  qa_runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [ -x "$qa_runtime/bin/fallback/pnpm" ]; then
    export PATH="$qa_runtime/node/bin:$qa_runtime/bin/fallback:$PATH"
  else
    echo "Install Node 24 and pnpm 11.25, then open this launcher again."
    exit 1
  fi
fi
exec pnpm qa:ui "$@"
