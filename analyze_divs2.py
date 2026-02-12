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

    div_opens = len(re.findall(r'<div[\s>/]', processed, re.IGNORECASE))
    div_opens += len(re.findall(r'<div\s*$', processed.rstrip(), re.IGNORECASE))
    div_closes = processed.lower().count('</div>')

    events = []
    for _ in range(div_opens):
        depth += 1
        events.append("+open(->%d)" % depth)
    for _ in range(div_closes):
        events.append("-close(->%d)" % (depth - 1))
        depth -= 1

    if events:
        trimmed = line.rstrip()[:100]
        out.append("L%4d d=%2d %-35s | %s" % (lineno, depth, ' '.join(events), trimmed))

with open("/tmp/div_full.txt", "w") as f:
    f.write("\n".join(out))
    f.write("\n\nFinal depth: %d\n" % depth)
