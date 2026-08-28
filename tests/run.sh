#!/usr/bin/env bash
# Roda a bateria inteira: lógica pura no Node + preenchimento real no Chrome.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "== 1/3  testes de lógica (Node) =========================================="
if node --test "tests/*.test.js" 2>&1 | tail -n 8; then :; else fail=1; fi
node --test "tests/*.test.js" >/dev/null 2>&1 || fail=1

echo
echo "== 2/3  preenchimento real no Chrome (headless) =========================="
CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
if [ -z "$CHROME" ]; then
  echo "  (pulado: nenhum Chrome/Chromium encontrado)"
else
  report=$("$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 \
    --dump-dom "file://$PWD/WebCopilot_Tester.html?selftest=1" 2>/dev/null |
    python3 -c "import sys,re,html;d=sys.stdin.read();m=re.search(r'<pre id=\"wc-report\"[^>]*>(.*?)</pre>',d,re.S);print(html.unescape(m.group(1)) if m else 'RELATORIO NAO ENCONTRADO')")
  echo "$report" | sed -n '3p'
  echo "$report" | grep -E '^(FALHOU|RESULTADO)' || true
  echo "$report" | grep -q "RESULTADO: TUDO OK" || fail=1
fi

echo
echo "== 3/3  manifesto aceito pelo Chrome ====================================="
if [ -n "${CHROME:-}" ]; then
  tmp=$(mktemp -d)
  cp -r . "$tmp/ext" && rm -rf "$tmp/ext/.git"
  if "$CHROME" --headless=new --no-sandbox --disable-gpu --pack-extension="$tmp/ext" >/dev/null 2>&1 && [ -f "$tmp/ext.crx" ]; then
    echo "  ok  manifest.json empacotou sem erro"
  else
    echo "  FALHOU  Chrome recusou o manifesto"
    fail=1
  fi
  rm -rf "$tmp"
fi

echo
[ "$fail" -eq 0 ] && echo "TUDO VERDE" || echo "HOUVE FALHAS"
exit $fail
