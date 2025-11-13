#!/usr/bin/env pwsh
<#
.SYNOPSIS
部署统一模式：统一字段名为 MongoDB 驼峰命名约定

.DESCRIPTION
此脚本执行以下操作：
1. 备份现有数据
2. 运行数据迁移脚本
3. 重启 PM2 服务
4. 验证服务状态
5. 测试 API 端点

.NOTES
运行前请确保：
- 已停止所有正在运行的编辑操作
- 已备份重要数据
- MongoDB 服务正在运行
#>

param(
    [switch]$SkipBackup,
    [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 58) -ForegroundColor Cyan
Write-Host "  统一模式部署脚本" -ForegroundColor Yellow
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

# 1. 备份数据
if (-not $SkipBackup) {
    Write-Host "[1/6] 📦 备份数据..." -ForegroundColor Cyan
    
    $backupDir = "backups/pre-unified-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # 备份 clubs.json
    if (Test-Path "public/data/clubs.json") {
        Copy-Item "public/data/clubs.json" "$backupDir/clubs.json.backup"
        Write-Host "   ✓ clubs.json 已备份" -ForegroundColor Green
    }
    
    # 导出 MongoDB 数据
    Write-Host "   ⏳ 导出 MongoDB 数据..." -ForegroundColor Yellow
    $mongoUri = $env:MONGODB_URI
    if ($mongoUri) {
        $dbName = ($mongoUri -split '/')[-1] -replace '\?.*', ''
        mongodump --uri="$mongoUri" --out="$backupDir/mongodb" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ MongoDB 已备份到 $backupDir/mongodb" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠ MongoDB 备份失败，继续执行..." -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
}

# 2. 运行迁移脚本
Write-Host "[2/6] 🔄 执行数据迁移..." -ForegroundColor Cyan
node scripts/migrate-to-unified-schema.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 迁移失败！请检查错误信息。" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. 验证语法
Write-Host "[3/6] 🔍 验证代码语法..." -ForegroundColor Cyan
$filesToCheck = @(
    "server/models/Club.js",
    "server/models/Submission.js",
    "server/middleware/validate.js",
    "server/routes/submissions.js",
    "server/routes/sync.js",
    "public/js/submit.js"
)

foreach ($file in $filesToCheck) {
    node -c $file 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ $file" -ForegroundColor Green
    }
    else {
        Write-Host "   ✗ $file 语法错误！" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# 4. 重启服务
if (-not $SkipRestart) {
    Write-Host "[4/6] 🔄 重启 PM2 服务..." -ForegroundColor Cyan
    pm2 restart gamedevmap-api
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ 服务已重启" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠ PM2 重启失败，尝试手动启动..." -ForegroundColor Yellow
        pm2 start ecosystem.config.js
    }
    
    Write-Host "   ⏳ 等待服务启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    Write-Host ""
}

# 5. 检查服务状态
Write-Host "[5/6] 📊 检查服务状态..." -ForegroundColor Cyan
pm2 list | Select-String "gamedevmap"
Write-Host ""

# 6. 测试 API 端点
Write-Host "[6/6] 🧪 测试 API 端点..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/clubs" -Method GET -TimeoutSec 5 2>&1
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ API 端点正常响应" -ForegroundColor Green
        
        $data = $response.Content | ConvertFrom-Json
        if ($data.success) {
            Write-Host "   ✓ 返回数据格式正确" -ForegroundColor Green
            Write-Host "   📊 社团数量: $($data.total)" -ForegroundColor Cyan
        }
    }
}
catch {
    Write-Host "   ⚠ API 测试失败: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   请手动验证服务状态" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  ✅ 部署完成！" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 后续步骤：" -ForegroundColor Yellow
Write-Host "   1. 检查 PM2 日志: pm2 logs gamedevmap-api" -ForegroundColor White
Write-Host "   2. 测试提交功能: http://localhost/submit.html" -ForegroundColor White
Write-Host "   3. 测试管理后台: http://localhost/admin/" -ForegroundColor White
Write-Host "   4. 运行验证脚本: node debug-diff-fixed.js" -ForegroundColor White
Write-Host ""

# 显示备份位置
if (-not $SkipBackup) {
    Write-Host "💾 备份位置: $backupDir" -ForegroundColor Cyan
    Write-Host ""
}
