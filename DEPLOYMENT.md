# 聊天室部署指南 - ritiandong.com

## 部署步骤

### 1. 添加 nginx 配置

将配置文件复制到 nginx 配置目录：

```bash
sudo cp nginx/ritiandong.com.conf /etc/nginx/sites-available/ritiandong.com
sudo ln -s /etc/nginx/sites-available/ritiandong.com /etc/nginx/sites-enabled/
```

### 2. 测试 nginx 配置

```bash
sudo nginx -t
```

如果测试通过，继续下一步。

### 3. 重启 nginx

```bash
sudo systemctl restart nginx
```

### 4. 确保后端服务器正在运行

```bash
cd /home/li7808/forlearning/claude/chatroom/backend
nohup python3 main.py > server.log 2>&1 &
```

### 5. 检查防火墙

确保 80 端口和 443 端口开放：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

或使用 firewalld：

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 6. 访问聊天室

现在你可以通过以下地址访问：

- **HTTP**: http://ritiandong.com/chat
- **HTTPS**: https://ritiandong.com/chat（配置 SSL 后）

## 可选：配置 HTTPS（推荐）

### 使用 Let's Encrypt 免费证书

#### 安装 certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

#### 获取证书

```bash
sudo certbot --nginx -d ritiandong.com
```

按照提示完成配置，certbot 会自动修改 nginx 配置并设置 HTTPS。

#### 自动续期

证书会自动续期，也可以手动测试：

```bash
sudo certbot renew --dry-run
```

## 配置文件位置

- **nginx 配置**: `/etc/nginx/sites-available/ritiandong.com`
- **后端代码**: `/home/li7808/forlearning/claude/chatroom/backend/`
- **前端代码**: `/home/li7808/forlearning/claude/chatroom/frontend/`
- **后端日志**: `/home/li7808/forlearning/claude/chatroom/backend/server.log`

## 管理命令

### 查看后端日志
```bash
tail -f /home/li7808/forlearning/claude/chatroom/backend/server.log
```

### 重启后端服务器
```bash
cd /home/li7808/forlearning/claude/chatroom/backend
pkill -f "python3 main.py"
nohup python3 main.py > server.log 2>&1 &
```

### 重启 nginx
```bash
sudo systemctl restart nginx
```

### 查看 nginx 状态
```bash
sudo systemctl status nginx
```

## 端口说明

| 服务 | 内部端口 | 外部端口 |
|------|----------|----------|
| 后端 API | 8000 | 通过 nginx 代理 |
| WebSocket | 8000/ws | 通过 nginx 代理 |
| 前端 | - | 80/443 (nginx) |

## 故障排查

### 无法访问聊天室

1. 检查 nginx 是否运行：
   ```bash
   sudo systemctl status nginx
   ```

2. 检查后端是否运行：
   ```bash
   ps aux | grep "python3 main.py"
   ```

3. 查看 nginx 错误日志：
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

4. 查看后端日志：
   ```bash
   tail -f /home/li7808/forlearning/claude/chatroom/backend/server.log
   ```

### WebSocket 连接失败

检查 nginx 配置中是否正确设置了 WebSocket 升级头：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 502 Bad Gateway

通常是因为后端服务未运行，请检查后端进程：

```bash
ps aux | grep "python3 main.py"
```

如果没有运行，重新启动后端服务。
