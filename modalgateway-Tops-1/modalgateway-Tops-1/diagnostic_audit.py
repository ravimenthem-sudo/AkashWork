
import json
from datetime import datetime

log_file = 'audit_logs.json'

errors = []
prev_timestamp = None

with open(log_file, 'r') as f:
    for i, line in enumerate(f, 1):
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"Line {i}: JSON Decode Error: {e}")
            continue

        timestamp_str = data.get('timestamp')
        latency_total = data.get('latency_total_s')
        latency_ttft = data.get('latency_ttft_s')
        latency_gen = data.get('latency_gen_s')
        tokens = data.get('tokens')
        tps = data.get('tps')

        # Check chronological order
        if timestamp_str:
            try:
                # Handle cases like "2026-02-26T17:22:35.772342"
                current_timestamp = datetime.fromisoformat(timestamp_str)
                if prev_timestamp and current_timestamp < prev_timestamp:
                    errors.append(f"Line {i}: Timestamp out of order. Got {timestamp_str}, previous was {prev_timestamp}")
                prev_timestamp = current_timestamp
            except ValueError:
                errors.append(f"Line {i}: Invalid timestamp format: {timestamp_str}")

        # Check latency logic
        if latency_total is not None and latency_ttft is not None and latency_gen is not None:
            # Adding a small epsilon for floating point comparison if needed, but here it's simple sum
            if latency_ttft + latency_gen > latency_total + 0.001:
                errors.append(f"Line {i}: Latency inconsistency. TTFT({latency_ttft}) + GEN({latency_gen}) = {latency_ttft + latency_gen:.3f} > TOTAL({latency_total})")

        # Check TPS calculation
        if tokens is not None and latency_gen is not None and tps is not None and latency_gen > 0:
            expected_tps = round(tokens / latency_gen, 2)
            if abs(tps - expected_tps) > 0.05: # Allowing some slack for rounding
                 errors.append(f"Line {i}: TPS mismatch. Tokens({tokens}) / GEN({latency_gen}) = {expected_tps}, but log has {tps}")

if errors:
    print("\n".join(errors))
else:
    print("No logical errors found.")
