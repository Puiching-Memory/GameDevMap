/**
 * 同步 clubs.json 的 ID 与 MongoDB _id
 * 确保两边数据一致
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Club = require('../server/models/Club');

async function syncIds() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    // 读取 clubs.json
    const jsonPath = path.join(__dirname, '../public/data/clubs.json');
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    const clubsFromJson = JSON.parse(jsonData);
    
    console.log(`📄 Found ${clubsFromJson.length} clubs in JSON\n`);

    // 获取所有 MongoDB 中的社团
    const clubsFromDb = await Club.find({});
    console.log(`💾 Found ${clubsFromDb.length} clubs in MongoDB\n`);

    // 创建映射：name + school -> MongoDB _id
    const dbClubMap = new Map();
    clubsFromDb.forEach(club => {
      const key = `${club.name}|${club.school}`;
      dbClubMap.set(key, club._id.toString());
    });

    // 更新 JSON 中的 ID
    let updated = 0;
    let notFound = 0;
    
    const updatedClubs = clubsFromJson.map(jsonClub => {
      const key = `${jsonClub.name}|${jsonClub.school}`;
      const dbId = dbClubMap.get(key);
      
      if (dbId) {
        if (jsonClub.id !== dbId) {
          console.log(`🔄 Updating ID for ${jsonClub.name} (${jsonClub.school})`);
          console.log(`   Old: ${jsonClub.id}`);
          console.log(`   New: ${dbId}`);
          updated++;
        }
        return { ...jsonClub, id: dbId };
      } else {
        console.warn(`⚠️  Not found in DB: ${jsonClub.name} (${jsonClub.school})`);
        notFound++;
        return jsonClub;
      }
    });

    // 写回 clubs.json
    await fs.writeFile(
      jsonPath,
      JSON.stringify(updatedClubs, null, 2),
      'utf8'
    );

    console.log('\n✅ Sync complete!');
    console.log(`📊 Statistics:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Total: ${clubsFromJson.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncIds();
