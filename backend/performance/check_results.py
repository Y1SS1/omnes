"""Reads the JMeter HTML report's statistics and fails when the API is too slow or errors too much.

Run it from inside the report folder (it reads ./statistics.json):
    python3 check_results.py [max error %] [max p95 ms]
"""

import json
import sys
from pathlib import Path

max_error_pct = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
max_p95_ms = float(sys.argv[2]) if len(sys.argv) > 2 else 2000.0

stats = json.loads(Path("statistics.json").read_text(encoding="utf-8"))
total = stats["Total"]
error_pct = total["errorPct"]
# JMeter's report keeps the 90th, 95th and 99th percentiles as pct1, pct2 and pct3.
p95 = total["pct2ResTime"]

print(f"{'Petición':<48}{'n':>7}{'error %':>9}{'prom. ms':>10}{'p95 ms':>9}")
for name, row in sorted(stats.items()):
    print(
        f"{name[:47]:<48}{row['sampleCount']:>7}{row['errorPct']:>9.2f}"
        f"{row['meanResTime']:>10.0f}{row['pct2ResTime']:>9.0f}"
    )
print(f"\nRendimiento: {total['throughput']:.1f} peticiones por segundo.")

failures = []
if error_pct > max_error_pct:
    failures.append(f"errores {error_pct:.2f} % (máximo {max_error_pct} %)")
if p95 > max_p95_ms:
    failures.append(f"p95 {p95:.0f} ms (máximo {max_p95_ms:.0f} ms)")

if failures:
    print("FALLA: " + "; ".join(failures))
    sys.exit(1)
print(f"OK: errores {error_pct:.2f} % y p95 {p95:.0f} ms, dentro de los límites.")
