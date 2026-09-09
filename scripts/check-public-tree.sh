#!/usr/bin/env bash
set -euo pipefail

failed=0

while IFS= read -r file; do
  case "$file" in
    .env.example) ;;
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|*.jks|*service-account*.json|*credentials*.json|*.sqlite|*.duckdb|*.db|*.dump|*.sql.gz)
      echo "::error file=$file::Sensitive/private file type must not be tracked in the public repository"
      failed=1
      ;;
  esac
done < <(git ls-files)

# Deliberately narrow high-confidence patterns. GitHub secret scanning/push protection should be
# enabled as a separate repository control because no local regex can recognize every credential.
pattern='-----BEGIN ([A-Z0-9 ]+)?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-ant-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}'
if matches=$(git grep -nEI "$pattern" -- ':!scripts/check-public-tree.sh' 2>/dev/null); then
  echo "$matches"
  echo "::error::A high-confidence credential/private-key pattern is tracked in the repository"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "Public-tree secret/private-file policy passed."
