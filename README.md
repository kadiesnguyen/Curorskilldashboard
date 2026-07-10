# CurorSkillDashboard

Dashboard local quản lý **Cursor Rules**, **Skills** và **mem0 Memories** — chạy trên máy, không cần cloud.

![Node](https://img.shields.io/badge/node-%3E%3D18-green) ![Docker](https://img.shields.io/badge/docker-compose-blue) ![License](https://img.shields.io/badge/license-MIT-blue)

## Chạy bằng Docker (khuyến nghị)

Dashboard **không bắt buộc Docker** — bản của bạn đang chạy `node server.mjs` trực tiếp. Docker giúp người mới cài nhanh kèm Qdrant (mem0).

```bash
git clone https://github.com/kadiesnguyen/Curorskilldashboard.git
cd Curorskilldashboard
cp .env.example .env   # chỉnh PROJECTS_ROOT, MEM0_USER_ID nếu cần
docker compose up -d --build
```

Mở: **http://localhost:3847**

| Service | Port | Mô tả |
|---------|------|--------|
| `dashboard` | 3847 | UI Rules / Skills / Memories |
| `qdrant` | 6333 | Vector DB cho mem0 |

**Volume mount (host → container):**

| Host | Container | Dùng cho |
|------|-----------|----------|
| `./data` | `/app/data` | Cấu hình dashboard |
| `~/.cursor` | `/root/.cursor` | Sync rules & skills global |
| `~/.agents` | `/root/.agents` | Skill roots |
| `~/Documents/GitHub` | `/projects` | Quét & sync theo project |

Dừng:

```bash
docker compose down
```

Xóa cả Qdrant data:

```bash
docker compose down -v
```

### Cursor MCP + Docker mem0

Trong `~/.cursor/mcp.json`, trỏ Qdrant **host** (không phải service name Docker):

```json
"MEM0_QDRANT_HOST": "localhost",
"MEM0_QDRANT_PORT": "6333",
"MEM0_USER_ID": "default"
```

`MEM0_USER_ID` phải trùng tab **Cài đặt** trên dashboard.

---

## Cài đặt nhanh (Node, không Docker)

```bash
git clone https://github.com/kadiesnguyen/Curorskilldashboard.git
cd Curorskilldashboard
cp data/store.example.json data/store.json
npm start
```

Mở: **http://127.0.0.1:3847**

Port tùy chỉnh: `CUROR_SKILL_DASHBOARD_PORT=4000 npm start`

---

## Tính năng

| Module | Mô tả |
|--------|--------|
| **Rules** | CRUD rule `.mdc`, preset 1-click, gán global/project, đồng bộ `~/.cursor/rules/` |
| **Skills** | CRUD skill `SKILL.md`, thêm thư mục skill tùy chỉnh, gán global/project/root, đồng bộ disk |
| **Memories** | Xem/tìm/xóa/thêm memory mem0 local (Qdrant) |
| **Projects** | Quét repo git, gán rules/skills theo project |

## Yêu cầu

**Docker:** Docker + Docker Compose v2 (đã gồm Qdrant + Python deps trong image)

**Node (native):**

- **Node.js** ≥ 18
- **Qdrant** local (port 6333) — cho tab Memories
- **Python 3** + `qdrant-client`, `fastembed` — chỉ cần khi **thêm memory** từ dashboard
- **uv** / **uvx** — cho mem0 MCP trong Cursor (tùy chọn)

## Cài đặt chi tiết (Node)

```bash
cd ~/Documents/GitHub/Curorskilldashboard

# Lần đầu: tạo store local
cp data/store.example.json data/store.json

# Chỉnh user id mem0 trong data/store.json nếu cần
# Hoặc dùng tab Cài đặt sau khi chạy

npm start
# hoặc: ./scripts/start.sh
```

Mở: **http://127.0.0.1:3847**

Port tùy chỉnh:

```bash
CUROR_SKILL_DASHBOARD_PORT=4000 npm start
```

## Cấu trúc thư mục

```
Curorskilldashboard/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── docker/entrypoint.sh
├── server.mjs           # HTTP API + static
├── lib/
│   ├── store.mjs        # JSON store (rules, skills, projects, mem0 config)
│   ├── sync.mjs         # Đồng bộ rules
│   ├── skill.mjs        # Parse SKILL.md
│   ├── skill-sync.mjs   # Đồng bộ skills
│   ├── mem0.mjs         # Qdrant API cho memories
│   └── presets.mjs      # Rule templates
├── public/              # UI dashboard
├── data/
│   └── store.example.json
├── scripts/
│   ├── start.sh
│   └── mem0_add.py      # Thêm memory (embedding local)
└── config/
    └── mcp-mem0.example.json
```

## Rules

1. Tạo/sửa rule trong tab **Rules**
2. Chọn **Global** hoặc tick **Projects**
3. **Lưu + Đồng bộ** → ghi file `.mdc` vào:
   - Global: `~/.cursor/rules/`
   - Project: `<repo>/.cursor/rules/`

Preset có sẵn: Admin CMS, TMDT, Persistent Memory (mem0), …

## Skills

1. Tab **Skills** → thêm **thư mục chứa skills** (skill roots)
2. **Quét skills** import từ disk
3. Tạo/sửa skill, gán phạm vi:
   - **Global** → `~/.cursor/skills/<id>/SKILL.md`
   - **Project** → `<repo>/.cursor/skills/<id>/SKILL.md`
   - **Skill root** → `<custom-root>/<id>/SKILL.md`

Skill roots mặc định:

```
~/.cursor/skills
~/.cursor/skills-cursor
~/.agents/skills
```

## Memories (mem0)

### Dashboard

- Tab **Memories**: list, tìm kiếm, xem chi tiết, xóa
- Form **Thêm memory** (cần Python deps bên dưới)
- **Cài đặt** → cấu hình Qdrant host/port/collection/user_id

### Python deps (thêm memory từ UI)

```bash
pip install qdrant-client fastembed
```

### mem0 MCP cho Cursor

Copy snippet vào `~/.cursor/mcp.json`:

```bash
cat config/mcp-mem0.example.json
```

Chỉnh `MEM0_USER_ID` trùng với dashboard (tab Cài đặt).

Tham khảo: [mem0-local-mcp](https://github.com/sanchezvivi/mem0-local-mcp)

### Rule persistent-memory

Dashboard có preset **Persistent Memory (mem0)** — cài rule để agent tự search/save memory qua MCP.

## Projects

- **Cài đặt** → thêm thư mục quét (vd. `~/Documents/GitHub`)
- **Quét projects** tìm repo có `.git`
- Gán rules/skills per project trong form editor

## API (local)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/store` | Full store |
| POST | `/api/sync` | Sync all rules + skills |
| POST | `/api/skills/scan` | Import skills từ roots |
| GET | `/api/memories?q=` | List memories |
| POST | `/api/memories` | Thêm memory |
| DELETE | `/api/memories/:id` | Xóa memory |
| GET | `/api/mem0/status` | Kiểm tra Qdrant |

## Data local

- `data/store.json` — gitignored, tạo từ `store.example.json`
- Không commit secrets; chỉ path local

## Troubleshooting

| Lỗi | Cách xử lý |
|-----|------------|
| Memories tab trống | Kiểm tra Qdrant: `curl localhost:6333/collections/mem0` |
| Thêm memory fail | `pip install qdrant-client fastembed` |
| Skills không quét được | Thêm đúng skill root, cấu trúc `<root>/<name>/SKILL.md` |
| Rule không sync | Bấm **Đồng bộ tất cả** hoặc **Lưu + Đồng bộ** |

## License

MIT — dùng tự do, chỉnh sửa thoải mái.
