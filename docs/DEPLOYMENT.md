# 生产环境部署指南

## 🚀 快速部署

### 1. 拉取最新代码
```bash
cd /home/www/GameDevMap
git pull origin main
```

### 2. 安装新依赖（如果有）
```bash
npm install
```

### 3. 运行数据迁移
初次部署或更新现有数据时运行：

```bash
# 将 clubs.json 导入到 MongoDB
npm run migrate:clubs
```

输出示例：
```
✅ Connected to MongoDB
📄 Found 100 clubs in clubs.json
  ✓ Imported: 厦门大学第九艺术游创社 (厦门大学)
  ✓ Imported: 萌屋 (湘潭大学)
  ...
📊 Migration Summary:
  ✓ Imported: 95
  ↻ Updated: 5
  ✗ Skipped: 0
  Total: 100
✅ Migration complete
```

### 4. 重启应用
```bash
pm2 restart gamedevmap-api
```

### 5. 验证部署
```bash
# 检查API是否正常
curl http://localhost:3001/api/clubs | jq '.data | length'

# 检查应用状态
pm2 logs gamedevmap-api --lines 20
```

---

### 🔧 配置要求
确保 `.env` 文件包含以下配置：

```env
# MongoDB连接
MONGODB_URI=mongodb://localhost:27017/gamedevmap

# 其他配置
PORT=3001
NODE_ENV=production
JWT_SECRET=your_jwt_secret
```

---

## 🔄 数据同步工作流

### 场景1: 通过管理后台添加社团
```
用户提交 → 管理员审批 → 自动写入MongoDB → 自动同步到clubs.json
```

### 场景2: 通过GitHub PR更新clubs.json
```bash
# 1. 合并PR后，在服务器上拉取最新代码
cd /home/www/GameDevMap
git pull origin main

# 2. 运行迁移命令
npm run migrate:clubs

# 3. 重启应用
pm2 restart gamedevmap-api
```

### 场景3: 手动同步数据库到JSON
```bash
# 导出MongoDB数据到clubs.json
npm run sync:json

# 提交更新
git add public/data/clubs.json
git commit -m "Update clubs.json from database"
git push origin main
```

---

## 🧪 测试验证

### 1. 测试API端点
```bash
# 获取所有社团
curl http://localhost:3001/api/clubs

# 获取单个社团
curl http://localhost:3001/api/clubs/<club_id>
```

预期响应：
```json
{
  "success": true,
  "data": [...],
  "total": 100
}
```

### 2. 测试前端加载
```bash
# 访问主页，检查浏览器控制台
# 应该看到：✓ Loaded 100 clubs
```

### 3. 测试提交和审批流程
1. 提交新社团：`http://your-domain.com/submit.html`
2. 登录管理后台：`http://your-domain.com/admin`
3. 批准提交
4. 检查：
   - MongoDB中是否有新记录：`db.clubs.count()`
   - clubs.json是否更新：`git diff public/data/clubs.json`
   - 前端地图是否显示新社团

### 4. 测试增强验证
提交一个社团，在管理后台查看：
- ⚠️ 黄色警告：检测到类似社团
- 距离偏差：显示实际距离

---

## 🐛 故障排查

### 问题1: API返回空数据
```bash
# 检查数据库
mongo gamedevmap
> db.clubs.count()

# 如果为0，运行迁移
npm run migrate:clubs
```

### 问题2: 前端显示旧数据
```bash
# 清除浏览器缓存
# 或强制刷新：Ctrl + Shift + R

# 检查API是否返回最新数据
curl http://localhost:3001/api/clubs | jq '.total'
```

### 问题3: 同步失败
```bash
# 检查日志
pm2 logs gamedevmap-api --err

# 手动运行同步脚本查看错误
node server/scripts/syncToJson.js
```

---

## 📊 监控指标

### 关键日志
```bash
# 实时监控
pm2 logs gamedevmap-api --follow

# 查看最近的同步
pm2 logs gamedevmap-api | grep "sync"

# 查看批准操作
pm2 logs gamedevmap-api | grep "approved"
```

### 数据一致性检查
```bash
# 比较数据库和JSON文件的记录数
mongo gamedevmap --eval "db.clubs.count()"
cat public/data/clubs.json | jq 'length'
```
