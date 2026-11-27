import re, os, html

BASE = r"D:\ai"

def inline(text):
    # 图片: ![alt](path) -> <img>
    def img(m):
        alt, path = m.group(1), m.group(2)
        full = os.path.join(BASE, path.replace('/', os.sep))
        if os.path.exists(full):
            with open(full, encoding='utf-8') as f:
                svg = f.read()
            # 内联 svg，去掉 xml 声明
            svg = re.sub(r'^<\?xml[^>]*\?>', '', svg).strip()
            return '<div class="fig"><div class="cap">%s</div>%s</div>' % (html.escape(alt), svg)
        return '<p class="missing">[图片缺失: %s]</p>' % html.escape(path)
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', img, text)
    # 链接
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    # 加粗 / 行内代码
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text

def convert(md_path, out_path):
    with open(md_path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    out = []
    i = 0
    n = len(lines)
    in_code = False
    code_buf = []
    while i < n:
        line = lines[i]
        # 代码块
        if line.strip().startswith('```'):
            if in_code:
                out.append('<pre><code>%s</code></pre>' % html.escape('\n'.join(code_buf)))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        # 标题
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            lvl = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lvl, inline(m.group(2)), lvl))
            i += 1
            continue
        # 表格
        if line.strip().startswith('|') and i+1 < n and re.match(r'^\s*\|?[\s:\-|]+\|?\s*$', lines[i+1]):
            header = [c.strip() for c in line.strip().strip('|').split('|')]
            i += 2
            rows = []
            while i < n and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            t = ['<table><thead><tr>']
            for h in header:
                t.append('<th>%s</th>' % inline(h))
            t.append('</tr></thead><tbody>')
            for r in rows:
                t.append('<tr>')
                for c in r:
                    t.append('<td>%s</td>' % inline(c))
                t.append('</tr>')
            t.append('</tbody></table>')
            out.append(''.join(t))
            continue
        # 引用
        if line.strip().startswith('>'):
            out.append('<blockquote>%s</blockquote>' % inline(line.strip().lstrip('>').strip()))
            i += 1
            continue
        # 列表
        if re.match(r'^\s*[-*]\s+', line):
            items = []
            while i < n and re.match(r'^\s*[-*]\s+', lines[i]):
                items.append(re.sub(r'^\s*[-*]\s+', '', lines[i]))
                i += 1
            out.append('<ul>%s</ul>' % ''.join('<li>%s</li>' % inline(x) for x in items))
            continue
        # 空行
        if line.strip() == '':
            i += 1
            continue
        # 普通段落
        out.append('<p>%s</p>' % inline(line))
        i += 1

    title = os.path.splitext(os.path.basename(md_path))[0]
    doc = '''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>%s</title>
<style>
body{font-family:"Microsoft YaHei",sans-serif;max-width:1100px;margin:30px auto;padding:0 20px;line-height:1.7;color:#222}
h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:6px}
table{border-collapse:collapse;width:100%%;margin:12px 0;font-size:14px}
th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}
th{background:#f5f5f5}
code{background:#f4f4f4;padding:2px 5px;border-radius:3px}
pre{background:#f8f8f8;padding:12px;overflow:auto;border-radius:5px}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #999;margin:10px 0;padding:6px 14px;color:#555;background:#fafafa}
.fig{margin:20px 0;padding:12px;border:1px solid #e0e0e0;border-radius:6px;text-align:center}
.fig .cap{font-weight:bold;margin-bottom:10px;color:#333}
.fig svg{max-width:100%%;height:auto}
.missing{color:#c00}
</style></head><body>
%s
</body></html>''' % (html.escape(title), '\n'.join(out))
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(doc)
    print('生成:', out_path)

# 转换详细设计
convert(os.path.join(BASE, 'CrossPilot-详细设计.md'), os.path.join(BASE, 'CrossPilot-详细设计_图文版.html'))
