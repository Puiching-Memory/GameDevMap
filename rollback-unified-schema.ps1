#!/usr/bin/env pwsh
<#
.SYNOPSIS
回滚统一模式部署

.DESCRIPTION
从备份恢复数据到迁移前的状态

.PARAMETER BackupPath
备份目录路径（默认使用最新的备份）

.EXAMPLE
.\rollback-unified-schema.ps1
.\rollback-unified-schema.ps1 -BackupPath "backups/pre-unified-20240115-143022"
#>

param(
    [string]$BackupPath
)

$ErrorActionPreference = "Stop"

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Red
Write-Host ("=" * 58) -ForegroundColor Red
Write-Host "  统一模式回滚脚本" -ForegroundColor Yellow
Write-Host ("=" * 60) -ForegroundColor Red
Write-Host ""

# 查找备份目录
if (-not $BackupPath) {
    $backups = Get-ChildItem -Path "backups" -Directory -Filter "pre-unified-*" | 
    Sort-Object Name -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "❌ 未找到备份目录！" -ForegroundColor Red
        exit 1
    }
    
    $BackupPath = $backups[0].FullName
    Write-Host "📁 使用最新备份: $($backups[0].Name)" -ForegroundColor Cyan
}

if (-not (Test-Path $BackupPath)) {
    Write-Host "❌ 备份目录不存在: $BackupPath" -ForegroundColor Red
    exit 1
}

# 确认回滚
Write-Host ""
Write-Host "⚠️  警告：此操作将恢复到迁移前的状态！" -ForegroundColor Yellow
Write-Host "   - 会覆盖当前 clubs.json" -ForegroundColor Yellow
Write-Host "   - 会恢复 MongoDB 数据" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "确认继续？(输入 YES 确认)"
if ($confirm -ne "YES") {
    Write-Host "❌ 已取消回滚" -ForegroundColor Red
    exit 0
}

Write-Host ""

# 1. 恢复 clubs.json
Write-Host "[1/3] 📦 恢复 clubs.json..." -ForegroundColor Cyan
$jsonBackup = Join-Path $BackupPath "clubs.json.backup"
if (Test-Path $jsonBackup) {
    Copy-Item $jsonBackup "public/data/clubs.json" -Force
    Write-Host "   ✓ clubs.json 已恢复" -ForegroundColor Green
}
else {
    Write-Host "   ⚠ 未找到 clubs.json 备份" -ForegroundColor Yellow
}
Write-Host ""

# 2. 恢复 MongoDB
Write-Host "[2/3] 🔄 恢复 MongoDB..." -ForegroundColor Cyan
$mongoBackup = Join-Path $BackupPath "mongodb"
if (Test-Path $mongoBackup) {
    $mongoUri = $env:MONGODB_URI
    if ($mongoUri) {
        mongorestore --uri="$mongoUri" --drop $mongoBackup 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ MongoDB 已恢复" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠ MongoDB 恢复失败" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host "   ⚠ 未找到 MongoDB 备份" -ForegroundColor Yellow
}
Write-Host ""

# 3. 重启服务
Write-Host "[3/3] 🔄 重启服务..." -ForegroundColor Cyan
pm2 restart gamedevmap-api
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ 服务已重启" -ForegroundColor Green
}
else {
    Write-Host "   ⚠ 重启失败，请手动检查" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "  ✅ 回滚完成！" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""
Write-Host "📋 已从备份恢复: $BackupPath" -ForegroundColor Cyan
Write-Host ""
