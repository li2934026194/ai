# 本地环境与真实数据复验（2026-11-19）

## 结论

本地验收已通过：Milvus、Ollama、PostgreSQL 均恢复；真实 UCI 数据集已构建并写入 PostgreSQL；全量测试 **122 passed + 6 subtests**；五闸 **5/5 PASS**。阿里云部署仍未执行，按用户要求放到最后。

## 1. 环境恢复

- PostgreSQL：使用项目内 `.pg\pgsql` 与 `.pg\data` 启动，`127.0.0.1:5432` 正常监听；正式验收不使用 SQLite。
- Milvus：`milvus-standalone` / `milvus-etcd` / `milvus-minio` 正常运行。
- Ollama：`bge-m3:latest` 已存在，`/api/embed` 实测成功。
- RAG 实测：`crosspilot_kb` 重建成功，25 条种子，1024 维、COSINE、HNSW；查询“退货运费谁承担”返回 `retrieval_ok=True`，top1 为 `id=6`。

### 故障原因与处理

最初 19530 无监听、Docker Desktop 未启动。启动 Docker 后，Dify/Attu 等无关容器也被自动拉起，曾出现分页文件不足、OpenBLAS 分配失败、WSL 崩溃与 Ollama 500。最终停止无关容器并重启 Docker/WSL 后台后恢复；Dify/Attu 仅停止，未删除数据。测试使用 OpenBLAS/OMP/MKL/NUMEXPR 单线程环境，避免内存峰值。

## 2. 真实 UCI 数据集

- 文件：`data/online_retail_II.xlsx`（45,622,278 bytes）。
- 数据集：`公开-UCI礼品20SKU-180天`；`dataset_id=ds_94ed9ae746425c53bbda`。
- 构建：`scripts/build_public_dataset.py` 正式执行成功，幂等重建通过。
- 规模：20 SKU；`sales_daily=3,600`；`inventory_daily=3,600`；`products=20`；`inbound_batches=0`（按设计，在途仅为仿真快照）。
- 时间窗：2011-06-13～2011-12-09；仿真断货 137 个 SKU·日；`on_hand<0` 为 0。
- API：`/api/datasets` 返回 200 且包含该数据集；`/api/p3/sku/85099B` 返回 200，`best_model=croston_sba`，建议量 2,150 件，占用资金 17,350.5 元，`meta/evidence.dataset_note` 均保留仿真说明。

**口径**：真实的是 UCI 成交需求；库存/在途、成本率、汇率、MOQ、箱规和交期含仿真或假设，不代表真实店铺库存效果。

## 3. 回归与五闸

- `python -m pytest tests -q`：**122 passed + 6 subtests**，2 个 warning 均为 FastAPI `on_event` 弃用提示。
- `python -m tests.gates`：**5/5 PASS**；G01、G02（16/16）、G03、G04、G05 全通过。
- 五闸证据：`docs/gates-latest.json`，`ran_at=2026-11-19T15:53:29`。

## 4. 尚未执行

- 阿里云 ECS、生产 PostgreSQL、Nginx/HTTPS、systemd 实际上传与部署。
- 生产管理员创建（`rbac_user` 当前为空；测试账号已清理）。
- 产品主数据导入、真实店铺数据验证。
