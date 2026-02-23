# 网页聊天室 - 点歌系统

一个功能完整的网页聊天室应用，支持实时聊天和在线点歌功能。

## 功能特性

### 用户系统
- 用户注册和登录
- JWT 认证
- 自动登录（本地存储）

### 聊天功能
- 实时消息推送（WebSocket）
- 消息历史记录
- 在线用户列表
- 用户加入/离开通知

### 点歌系统
- 支持音乐 URL 添加
- 支持本地文件上传（MP3, WAV, M4A, OGG, FLAC）
- 播放队列管理
- 上一首/下一首控制
- 自动播放下一首

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动服务器

使用启动脚本：
```bash
./start.sh
```

或手动启动：
```bash
cd backend
python3 main.py
```

### 3. 访问应用

- **API 文档**: http://localhost:8000/docs
- **前端页面**: 在浏览器中打开 `frontend/index.html`

## 技术栈

### 后端
- **FastAPI**: 现代化的 Python Web 框架
- **WebSocket**: 实时双向通信
- **SQLAlchemy**: ORM 数据库操作
- **SQLite**: 轻量级数据库
- **JWT**: 用户认证
- **Passlib**: 密码加密

### 前端
- 原生 JavaScript（无需框架）
- WebSocket API
- Fetch API
- CSS3（渐变、动画、响应式设计）

## 项目结构

```
chatroom/
├── backend/
│   ├── main.py              # FastAPI 主程序
│   ├── auth.py              # 认证模块
│   ├── database.py          # 数据库模型
│   ├── websocket_manager.py # WebSocket 管理
│   ├── requirements.txt     # Python 依赖
│   ├── uploads/             # 上传的文件
│   └── chatroom.db          # SQLite 数据库
├── frontend/
│   ├── index.html           # 主页面
│   ├── app.js               # 前端逻辑
│   └── style.css            # 样式文件
├── start.sh                 # 启动脚本
└── README.md                # 说明文档
```

## API 端点

### REST API
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/messages` - 获取聊天记录
- `GET /api/queue` - 获取播放队列
- `POST /api/upload-music` - 上传音乐文件

### WebSocket
- `WS /ws?token=<jwt_token>` - WebSocket 连接

WebSocket 消息类型：
- `chat_message` - 发送聊天消息
- `add_to_queue` - 添加到播放队列
- `remove_from_queue` - 从队列移除

## 常用命令

### 查看服务器日志
```bash
tail -f backend/server.log
```

### 停止服务器
```bash
pkill -f 'python3 main.py'
```

### 重置数据库
```bash
rm backend/chatroom.db
# 重启服务器会自动创建新数据库
```

## 配置说明

### 修改端口
编辑 `backend/main.py` 最后一行：
```python
uvicorn.run(app, host="0.0.0.0", port=8000)  # 修改 8000 为其他端口
```

### 修改 JWT 密钥
编辑 `backend/auth.py`：
```python
SECRET_KEY = "your-secret-key-change-this-in-production"  # 修改为随机字符串
```

## 浏览器兼容性

- Chrome/Edge (推荐)
- Firefox
- Safari

## 注意事项

1. 音乐文件上传限制为 50MB
2. 支持的音频格式：MP3, WAV, M4A, OGG, FLAC
3. 密码最少需要 6 个字符
4. 使用 `file://` 协议打开 HTML 可能会有 CORS 限制，建议使用本地服务器

## 本地开发（可选）

如果遇到 CORS 问题，可以使用简单 HTTP 服务器：

```bash
cd frontend
python3 -m http.server 3000
```

然后访问 http://localhost:3000
