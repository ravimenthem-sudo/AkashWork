
import json
import os

log_file = r'd:\chatbot\AkashWork\modalgateway-Tops-1\modalgateway-Tops-1\audit_logs.json'
temp_file = log_file + '.tmp'

fixed_count = 0
total_count = 0

with open(log_file, 'r') as f_in, open(temp_file, 'w') as f_out:
    for line in f_in:
        line = line.strip()
        if not line:
            f_out.write("\n")
            continue
        
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            f_out.write(line + "\n")
            continue
            
        total_count += 1
        latency_total = data.get('latency_total_s')
        latency_ttft = data.get('latency_ttft_s')
        latency_gen = data.get('latency_gen_s')
        tokens = data.get('tokens')
        
        # Logical check: total should be sum of ttft and gen
        # In current logs, they are often independent. We prioritize TOTAL and TTFT.
        if latency_total is not None and latency_ttft is not None:
            new_gen = round(latency_total - latency_ttft, 3)
            if new_gen < 0: new_gen = 0.0
            
            # If there was a mismatch or we need to recalculate TPS
            needs_fix = abs((latency_ttft + latency_gen) - latency_total) > 0.005
            
            if needs_fix or True: # Force refresh for consistency
                data['latency_gen_s'] = new_gen
                if tokens is not None and new_gen > 0:
                    data['tps'] = round(tokens / new_gen, 2)
                elif tokens is not None:
                    data['tps'] = 0.0
                fixed_count += 1
                
        f_out.write(json.dumps(data) + "\n")

os.replace(temp_file, log_file)
print(f"Processed {total_count} lines. Recalibrated {fixed_count} lines.")
