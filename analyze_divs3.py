import re

with open("/Users/alex/Documents/ToAviate_software/frontend/views/manageclub/maintenance_detail.html") as f:
    lines = f.readlines()

start = 620
end = 1470

depth = 0
in_comment = False

out = []

for i in range(start, end):
    line = lines[i]
    lineno = i + 1
    raw = line

    # Strip out comment regions
    processed = ""
    j = 0
    while j < len(raw):
        if in_comment:
            close_pos = raw.find("-->", j)
            if close_pos != -1:
                in_comment = False
                j = close_pos + 3
            else:
                j = len(raw)
        else:
            open_pos = raw.find("<!--", j)
            if open_pos != -1:
                processed += raw[j:open_pos]
                close_pos = raw.find("-->", open_pos + 4)
                if close_pos != -1:
                    j = close_pos + 3
                else:
                    in_comment = True
                    j = len(raw)
            else:
                processed += raw[j:]
                j = len(raw)

    # Count <div openings: match <div followed by whitespace, >, /, or end of string
    div_opens = len(re.findall(r'<div(?=[\s>/]|$)', processed, re.IGNORECASE | re.MULTILINE))
    div_closes = processed.lower().count('</div>')

    events = []
    for _ in range(div_opens):
        depth += 1
        events.append("+open(->%d)" % depth)
    for _ in range(div_closes):
        events.append("-close(->%d)" % (depth - 1))
        depth -= 1

    if events:
        trimmed = line.rstrip()[:120]
        out.append("L%4d d=%2d %-35s | %s" % (lineno, depth, ' '.join(events), trimmed))

with open("/tmp/div_fixed.txt", "w") as f:
    f.write("\n".join(out))
    f.write("\n\nFinal depth: %d\n" % depth)

# Also print summary
body_close = None
footer_line = None
for line_out in out:
    if "wp-panel-footer" in line_out:
        footer_line = line_out.split()[0]
    parts = line_out.split()
    d_val = int(parts[1].split("=")[1])
    if d_val == 0 and "-close" in line_out and body_close is None:
        body_close = parts[0]

with open("/tmp/div_fixed.txt", "a") as f:
    f.write("wp-panel-body closes at: %s\n" % body_close)
    f.write("wp-panel-footer at: %s\n" % footer_line)
