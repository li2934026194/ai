<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

interface DocFileItem {
  path: string;
  name: string;
  display_name: string;
  ext: string;
  size_kb: number;
}

interface DocFolderItem {
  key: string;
  label: string;
  files: DocFileItem[];
}

const folders = ref<DocFolderItem[]>([]);
const openFolders = ref<Record<string, boolean>>({
  root: true,
  requirements: false,
  "prototypes/dfd_v6": false,
});
const activeFile = ref<DocFileItem | null>(null);
const mdContent = ref("");
const loading = ref(false);
const errorMsg = ref("");

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(s: string): string {
  let out = escHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="doc-link">$1 ($2)</span>');
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let inList = false;
  let inTable = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      closeList();
      closeTable();
      if (!inCode) {
        inCode = true;
        html.push('<pre class="doc-pre"><code>');
      } else {
        inCode = false;
        html.push("</code></pre>");
      }
      continue;
    }
    if (inCode) {
      html.push(escHtml(line) + "\n");
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      closeTable();
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeList();
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        html.push('<table class="doc-table"><thead><tr>');
        for (const c of cells) html.push(`<th>${renderInline(c)}</th>`);
        html.push("</tr></thead><tbody>");
      } else {
        html.push("<tr>");
        for (const c of cells) html.push(`<td>${renderInline(c)}</td>`);
        html.push("</tr>");
      }
      continue;
    } else {
      closeTable();
    }

    if (trimmed === "---") {
      closeList();
      html.push("<hr />");
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      html.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      html.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${renderInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }
    if (/^[-*] /.test(trimmed) || /^\d+\. /.test(trimmed)) {
      if (!inList) {
        inList = true;
        html.push("<ul>");
      }
      const itemText = trimmed.replace(/^([-*]|\d+\.)\s+/, "");
      html.push(`<li>${renderInline(itemText)}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }
  closeList();
  closeTable();
  if (inCode) html.push("</code></pre>");
  return html.join("\n");
}

const renderedHtml = computed(() => renderMarkdown(mdContent.value));

async function loadTree() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const res = await fetch("/api/v1/docs/tree");
    const json = await res.json();
    folders.value = json?.data?.folders || [];
    const rootFolder = folders.value.find((f) => f.key === "root");
    const defaultDoc =
      rootFolder?.files.find((f) => f.name === "06_test_execution_report.md") ||
      rootFolder?.files.find((f) => f.ext === "md") ||
      folders.value[0]?.files[0];
    if (defaultDoc) {
      await openFile(defaultDoc);
    }
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : "加载文档目录失败";
  } finally {
    loading.value = false;
  }
}

async function openFile(file: DocFileItem) {
  activeFile.value = file;
  errorMsg.value = "";
  if (file.ext !== "md") {
    mdContent.value = "";
    return;
  }
  try {
    const res = await fetch(`/api/v1/docs/content?path=${encodeURIComponent(file.path)}`);
    const json = await res.json();
    mdContent.value = json?.data?.content || "";
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : "读取文档内容失败";
  }
}

function downloadUrl(path: string): string {
  return `/api/v1/docs/download?path=${encodeURIComponent(path)}`;
}

function toggleFolder(key: string) {
  openFolders.value[key] = !openFolders.value[key];
}

onMounted(() => {
  void loadTree();
});
</script>

<template>
  <div class="docs-layout">
    <aside class="card docs-tree">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:14px;">📁 按文件夹浏览交付文档</strong>
        <button type="button" class="btn btn-sm" @click="loadTree">刷新</button>
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
        点击 <code>.md</code> 可直接在线阅读；点击 <code>⬇</code> 可下载对应 Word (<code>.docx</code>) 或 Markdown 文件。
      </div>

      <div v-for="folder in folders" :key="folder.key" class="docs-folder">
        <button type="button" class="docs-folder-btn" @click="toggleFolder(folder.key)">
          <span>{{ openFolders[folder.key] ? "▾ 📂" : "▸ 📁" }} {{ folder.label }}</span>
          <span class="pill p-gray">{{ folder.files.length }}</span>
        </button>

        <div v-if="openFolders[folder.key]" class="docs-file-list">
          <div
            v-for="f in folder.files"
            :key="f.path"
            class="docs-file-row"
            :class="{ active: activeFile?.path === f.path }"
          >
            <button type="button" class="docs-file-btn" @click="openFile(f)">
              <span class="docs-ext-tag" :class="f.ext">{{ f.ext.toUpperCase() }}</span>
              <span class="docs-file-name" :title="f.display_name">{{ f.display_name }}</span>
            </button>
            <a
              class="docs-dl-btn"
              :href="downloadUrl(f.path)"
              :download="f.name"
              title="下载文件"
            >
              ⬇
            </a>
          </div>
        </div>
      </div>
    </aside>

    <section class="card docs-reader">
      <div v-if="errorMsg" class="alert alert-red">{{ errorMsg }}</div>

      <template v-if="activeFile">
        <div class="docs-reader-head">
          <div>
            <strong style="font-size:16px;">{{ activeFile.display_name }}</strong>
            <div style="font-size:12px;color:#64748b;">
              仓库路径：<code>docs/{{ activeFile.path }}</code> · {{ activeFile.size_kb }} KB
            </div>
          </div>
          <a
            class="btn btn-sm btn-primary"
            :href="downloadUrl(activeFile.path)"
            :download="activeFile.name"
          >
            ⬇ 下载此文件
          </a>
        </div>

        <div v-if="activeFile.ext === 'md'" class="doc-markdown" v-html="renderedHtml" />

        <div v-else-if="activeFile.ext === 'png'" style="padding:12px 0;text-align:center;">
          <img
            :src="downloadUrl(activeFile.path)"
            :alt="activeFile.display_name"
            style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px;"
          />
        </div>

        <div v-else class="alert alert-blue" style="margin-top:12px;">
          <strong>Word 二进制文档（.docx）预览提示：</strong>
          浏览器不直接渲染 <code>.docx</code>，请点击右上角 <strong>「⬇ 下载此文件」</strong> 在本地 Word/WPS 中打开，或点击左侧同级目录下的对应 <code>.md</code> 文件直接在线阅读完整排版内容。
        </div>
      </template>

      <div v-else-if="loading" style="color:#64748b;">正在加载交付文档目录...</div>
    </section>
  </div>
</template>

<style scoped>
.docs-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 980px) {
  .docs-layout {
    grid-template-columns: 1fr;
  }
}
.docs-tree {
  max-height: 78vh;
  overflow-y: auto;
}
.docs-folder {
  margin-bottom: 8px;
}
.docs-folder-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}
.docs-file-list {
  margin-top: 4px;
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.docs-file-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 2px 4px;
}
.docs-file-row.active {
  background: #eff6ff;
}
.docs-file-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  text-align: left;
}
.docs-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #1e293b;
}
.docs-ext-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}
.docs-ext-tag.md {
  background: #dbeafe;
  color: #1d4ed8;
}
.docs-ext-tag.docx {
  background: #dcfce7;
  color: #15803d;
}
.docs-ext-tag.png {
  background: #fef3c7;
  color: #b45309;
}
.docs-dl-btn {
  text-decoration: none;
  font-size: 12px;
  padding: 2px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #334155;
}
.docs-reader {
  min-height: 70vh;
}
.docs-reader-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
}
.doc-markdown :deep(h1) {
  font-size: 20px;
  margin: 12px 0 8px;
}
.doc-markdown :deep(h2) {
  font-size: 16px;
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}
.doc-markdown :deep(h3) {
  font-size: 14px;
  margin: 12px 0 6px;
}
.doc-markdown :deep(p),
.doc-markdown :deep(li) {
  font-size: 13px;
  line-height: 1.65;
  color: #1e293b;
}
.doc-markdown :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  background: #f8fafc;
  border-left: 3px solid #3b82f6;
  font-size: 13px;
}
.doc-markdown :deep(.doc-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 12px;
}
.doc-markdown :deep(.doc-table th),
.doc-markdown :deep(.doc-table td) {
  border: 1px solid #cbd5e1;
  padding: 6px 8px;
  text-align: left;
}
.doc-markdown :deep(.doc-table th) {
  background: #f1f5f9;
}
.doc-markdown :deep(.doc-pre) {
  background: #0f172a;
  color: #f8fafc;
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
.doc-markdown :deep(code) {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
.doc-markdown :deep(.doc-pre code) {
  background: transparent;
  padding: 0;
}
</style>
