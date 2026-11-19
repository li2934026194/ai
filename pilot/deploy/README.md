# 阿里云部署模板（PACK 23）

> 这是**模板**，不是已经部署完成的证据。当前代码可运行、可测试；ECS/域名/证书需要你实际购买和配置。
> 目标形态：单台 ECS + Nginx(HTTPS) + FastAPI(127.0.0.1:8000) + PostgreSQL；Milvus 可后置单独部署。

## 1. 服务器

- Ubuntu 22.04/24.04，2C4G 起步；Python 3.12/3.13。
- 安全组只放行：22（你的固定 IP）、80、443。
- **不要**对公网开放 5432（PostgreSQL）、19530（Milvus）。

## 2. 目录与用户

```bash
sudo useradd -m -s /bin/bash pilot
sudo mkdir -p /opt/pilot
sudo chown -R pilot:pilot /opt/pilot
```

把项目上传到 `/opt/pilot`。**不要上传** `.venv`、`data/pilot.db`、`_backup_pack*`、`__pycache__`、`frontend/node_modules`。

```bash
cd /opt/pilot
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd frontend && npm ci && npm run build && cd ..
```

## 3. PostgreSQL

```bash
sudo apt install postgresql
sudo -u postgres createuser --createdb pilot
sudo -u postgres createdb -O pilot pilot
# 生产请设置密码，不要用免密
sudo -u postgres psql -c "ALTER USER pilot WITH PASSWORD '替换成强密码';"
```

`.env`（权限 600，不要提交 git）：

```ini
DATABASE_URL=postgresql+psycopg://pilot:替换成强密码@127.0.0.1:5432/pilot
AUTH_ENABLED=1
AUTH_JWT_SECRET=替换成至少32字节的随机值
AUTH_JWT_ISSUER=pilot
AUTH_JWT_AUDIENCE=pilot-api
AUTH_JWT_TTL_MINUTES=60
CORS_ORIGINS=https://你的域名
RBAC_ADMIN_USERNAME=admin
RBAC_ADMIN_PASSWORD=替换成至少8位的强密码
```

```bash
chmod 600 /opt/pilot/.env
```

## 4. 建表 + 初始化管理员

```bash
cd /opt/pilot
.venv/bin/python scripts/seed_rbac.py
```

第一次会创建 19 个权限、6 个角色；有 `RBAC_ADMIN_USERNAME/PASSWORD` 时创建管理员。
生产不要保留测试账号；登录后可在 P7 权限页改密码/加人。

## 5. systemd

复制 `deploy/pilot.service` 到 `/etc/systemd/system/pilot.service`，按实际路径修改：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pilot
sudo systemctl status pilot
curl http://127.0.0.1:8000/api/health
```

## 6. Nginx + HTTPS

复制 `deploy/nginx-pilot.conf` 到 `/etc/nginx/sites-available/pilot.conf`，替换 `__DOMAIN__`，再：

```bash
sudo ln -s /etc/nginx/sites-available/pilot.conf /etc/nginx/sites-enabled/pilot.conf
sudo nginx -t
sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

Nginx 负责：
- `/api` 反代到 FastAPI；
- `/` 提供 `web/dist` 静态前端；
- `/docs`、`/openapi.json` 默认只允许内网/白名单（模板已注释，按需启用）。

## 7. 验收

```bash
# 后端
curl https://你的域名/api/health
# 未登录 → 401
curl -i https://你的域名/api/datasets
# 登录 → token
curl -s -X POST https://你的域名/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"你的密码"}'
# 带 token → 200
curl -H "Authorization: Bearer <access_token>" https://你的域名/api/rbac/users
```

## 8. 备份与运维

```bash
# 每天 pg_dump，保留 7 天
pg_dump -U pilot -h 127.0.0.1 pilot | gzip > /opt/backup/pilot-$(date +%F).sql.gz
```

- 不要把 `.env`、`pg_dump`、JWT 密钥放进 git 或公开分享。
- 生产打开 `AUTH_ENABLED=1` 后才算有鉴权；演示模式 `0` 只用于本地/答辩前联调。
- Milvus 未起时 RAG 走降级，不影响 RBAC、登录与主业务只读接口；起 Milvus 后再跑全量测试。

## 9. 当前未完成（不能对外宣称）

- ECS 实例、域名、ICP 备案（若用公网域名）、HTTPS 证书、真实上传均未执行；
- 没有 Dockerfile/docker-compose；如老师要求容器化，另行补；
- 没有 refresh token、登录限流、四眼原则（提交人不得审批自己）；
- 真实 UCI 数据尚未入库。
