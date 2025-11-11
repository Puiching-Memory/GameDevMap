const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Club = require('../models/Club');

/**
 * Migration Script: clubs.json -> MongoDB
 * 
 * 读取 public/data/clubs.json 并导入到 MongoDB
 * 用于初始化数据库或同步静态数据到数据库
 */

async function migrateClubs() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 读取 clubs.json
    const clubsJsonPath = path.join(__dirname, '../../public/data/clubs.json');
    const data = await fs.readFile(clubsJsonPath, 'utf8');
    const clubs = JSON.parse(data);

    console.log(`📄 Found ${clubs.length} clubs in clubs.json`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    // 导入每个社团
    for (const club of clubs) {
      try {
        // 检查是否已存在（通过 name + school 判断）
        const existing = await Club.findOne({
          name: club.name,
          school: club.school
        });

        const clubData = {
          name: club.name,
          school: club.school,
          province: club.province,
          city: club.city || '',
          coordinates: [club.longitude, club.latitude], // [lng, lat]
          description: club.long_description || club.short_description || '',
          shortDescription: club.short_description || '',
          tags: club.tags || [],
          logo: club.img_name || '',
          website: club.website || '',
          contact: club.contact || {},
          verifiedBy: 'system',
          updatedAt: new Date()
        };

        if (existing) {
          // 更新现有记录
          await Club.findByIdAndUpdate(existing._id, clubData);
          updated++;
          console.log(`  ↻ Updated: ${club.name} (${club.school})`);
        } else {
          // 创建新记录
          const newClub = new Club({
            ...clubData,
            createdAt: new Date()
          });
          await newClub.save();
          imported++;
          console.log(`  ✓ Imported: ${club.name} (${club.school})`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to import ${club.name}:`, error.message);
        skipped++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✓ Imported: ${imported}`);
    console.log(`  ↻ Updated: ${updated}`);
    console.log(`  ✗ Skipped: ${skipped}`);
    console.log(`  Total: ${clubs.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Migration complete');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateClubs();
}

module.exports = migrateClubs;
