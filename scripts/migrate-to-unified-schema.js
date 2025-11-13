#!/usr/bin/env node
/**
 * 数据迁移脚本：统一为 MongoDB 驼峰命名约定
 * 
 * 变更：
 * 1. clubs.json 字段名统一为驼峰命名
 * 2. 移除 external_links 中的 _id 字段
 * 3. external_links 重命名为 externalLinks
 * 4. 坐标字段统一为 coordinates: [longitude, latitude]
 * 5. MongoDB 也同步更新字段名
 * 
 * 用法：node scripts/migrate-to-unified-schema.js
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../server/models/Club');

// 备份文件
async function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  await fs.copyFile(filePath, backupPath);
  console.log(`✅ 备份已创建: ${backupPath}`);
  return backupPath;
}

// 转换 JSON 对象为统一格式
function convertToUnifiedFormat(club) {
  // 处理 externalLinks，移除 _id 字段
  let externalLinks = [];
  const links = club.external_links || club.externalLinks || [];
  if (Array.isArray(links)) {
    externalLinks = links.map(link => ({
      type: link.type,
      url: link.url
      // 不包含 _id 字段
    }));
  }

  return {
    id: club._id ? club._id.toString() : club.id,
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    // 统一为 coordinates 数组格式
    coordinates: club.coordinates 
      ? club.coordinates 
      : [
          parseFloat(club.longitude) || 0,
          parseFloat(club.latitude) || 0
        ],
    // 使用驼峰命名
    imgName: club.logo || club.img_name || club.imgName || '',
    shortDescription: club.shortDescription || club.short_description || '',
    description: club.description || club.long_description || '',
    tags: club.tags || [],
    externalLinks: externalLinks
  };
}

async function migrateJsonFile() {
  console.log('\n📄 开始迁移 clubs.json 文件...\n');
  
  const jsonPath = path.resolve(__dirname, '../public/data/clubs.json');
  
  // 创建备份
  await createBackup(jsonPath);
  
  // 读取现有数据
  const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  console.log(`📊 读取到 ${jsonData.length} 条记录`);
  
  // 转换所有记录
  const convertedData = jsonData.map(club => convertToUnifiedFormat(club));
  
  // 写入新格式
  await fs.writeFile(
    jsonPath,
    JSON.stringify(convertedData, null, 2),
    'utf8'
  );
  
  console.log(`✅ JSON 文件已更新为统一格式`);
  console.log(`   - 字段名：驼峰命名`);
  console.log(`   - 坐标：coordinates 数组`);
  console.log(`   - 外部链接：externalLinks (无 _id)\n`);
  
  return convertedData.length;
}

async function migrateMongoDB() {
  console.log('💾 开始迁移 MongoDB 数据...\n');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ 已连接到 MongoDB\n');
  
  const clubs = await Club.find({});
  console.log(`📊 找到 ${clubs.length} 条记录需要更新\n`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const club of clubs) {
    let needsUpdate = false;
    const updates = {};
    
    // 检查并移除 externalLinks 中的 _id
    if (club.external_links && Array.isArray(club.external_links)) {
      const cleanedLinks = club.external_links.map(link => ({
        type: link.type,
        url: link.url
      }));
      updates.external_links = cleanedLinks;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await Club.updateOne({ _id: club._id }, { $set: updates });
      updated++;
      console.log(`✓ 更新: ${club.name} (${club.school})`);
    } else {
      skipped++;
    }
  }
  
  console.log(`\n✅ MongoDB 更新完成:`);
  console.log(`   - 已更新: ${updated} 条`);
  console.log(`   - 无需更新: ${skipped} 条\n`);
  
  await mongoose.disconnect();
  return updated;
}

async function main() {
  console.log('🚀 开始数据迁移到统一模式\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. 迁移 JSON 文件
    const jsonCount = await migrateJsonFile();
    
    // 2. 迁移 MongoDB
    const dbCount = await migrateMongoDB();
    
    console.log('=' .repeat(60));
    console.log('\n🎉 迁移完成！\n');
    console.log('📊 统计信息:');
    console.log(`   - JSON 记录: ${jsonCount} 条`);
    console.log(`   - MongoDB 更新: ${dbCount} 条`);
    console.log('\n⚠️  下一步操作:');
    console.log('   1. 检查备份文件是否正确');
    console.log('   2. 更新前端代码以使用新字段名');
    console.log('   3. 重启服务: pm2 restart gamedevmap-api');
    console.log('   4. 测试所有功能');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
