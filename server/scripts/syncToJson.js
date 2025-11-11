const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');

/**
 * Sync Script: MongoDB -> clubs.json
 * 
 * 从 MongoDB 导出所有社团到 public/data/clubs.json
 * 用于保持静态 JSON 文件与数据库同步（开源项目需求）
 */

async function syncToJson() {
  try {
    // 检查数据库连接状态（不主动连接）
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ MongoDB not connected, attempting to connect...');
      await mongoose.connect(process.env.MONGODB_URI);
    }

    console.log('Using existing MongoDB connection');

    // 获取所有社团
    const clubs = await Club.find({})
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📊 Found ${clubs.length} clubs in MongoDB`);

    // 转换为 clubs.json 格式
    const formattedClubs = clubs.map(club => ({
      id: club._id.toString(),
      name: club.name,
      school: club.school,
      city: club.city || '',
      province: club.province,
      latitude: club.coordinates[1],  // [lng, lat] -> lat
      longitude: club.coordinates[0], // [lng, lat] -> lng
      img_name: club.logo || '',
      short_description: club.shortDescription || '',
      long_description: club.description || '',
      tags: club.tags || [],
      website: club.website || '',
      contact: club.contact || {}
    }));

    // 写入 clubs.json
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    
    // 备份现有文件
    try {
      const backupPath = path.join(__dirname, '../../public/data/clubs.json.backup');
      await fs.copyFile(clubsJsonPath, backupPath);
      console.log('✓ Backup created: clubs.json.backup');
    } catch (error) {
      console.log('ℹ No existing clubs.json to backup');
    }

    // 写入新数据
    await fs.writeFile(
      clubsJsonPath,
      JSON.stringify(formattedClubs, null, 2),
      'utf8'
    );

    console.log('✅ Successfully synced to clubs.json');
    console.log(`📝 Total clubs: ${formattedClubs.length}`);

    return { success: true, count: formattedClubs.length };

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

// Run sync if called directly
if (require.main === module) {
  syncToJson()
    .then(() => {
      console.log('✅ Sync complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    });
}

module.exports = syncToJson;
