import re

with open("/Users/alex/Documents/ToAviate_software/frontend/views/manageclub/maintenance_detail.html") as f:
    lines = f.readlines()

start = 620  # 0-indexed for line 621
end = 1470   # 0-indexed exclusive for line 1470

depth = 0
in_comment = False
footer_line = None
footer_depth = None
body_close_line = None

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

    # Count <div openings (handles <div>, <div ..., <div\n)
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

    if 'wp-panel-footer' in processed:
        footer_line = lineno
        footer_depth = depth

    if depth == 0 and div_closes > 0 and body_close_line is None:
        body_close_line = lineno

    if events:
        trimmed = line.rstrip()[:120]
        print("L%4d d=%2d %-35s | %s" % (lineno, depth, ' '.join(events), trimmed))

print()
print("=== RESULTS ===")
print("wp-panel-body closes at line: %s" % body_close_line)
print("wp-panel-footer found at line: %s" % footer_line)
if footer_line and body_close_line:
    if footer_line < body_close_line:
        print("wp-panel-footer is INSIDE wp-panel-body")
    else:
        print("wp-panel-footer is OUTSIDE wp-panel-body")
print("Final depth at line 1470: %d" % depth)
