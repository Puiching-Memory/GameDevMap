#!/usr/bin/env node
/**
 * 调试脚本：详细显示MongoDB和JSON之间的差异
 * 用法: node debug-diff.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Club = require('./server/models/Club');

/**
 * 递归移除对象中的所有 _id 字段
 */
function removeIds(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeIds(item));
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== '_id') {
      cleaned[key] = removeIds(value);
    }
  }
  
  return cleaned;
}

/**
 * 深度比较两个对象
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    // 清理对象，移除所有 _id 字段以进行比较
    const cleanVal1 = removeIds(val1);
    const cleanVal2 = removeIds(val2);
    
    if (JSON.stringify(cleanVal1) !== JSON.stringify(cleanVal2)) {
      differences.push({
        field: key,
        database: val1,
        json: val2
      });
    }
  }
  
  return differences;
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 读取 clubs.json
    const jsonPath = path.resolve(__dirname, 'public/data/clubs.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📄 JSON file loaded: ${jsonData.length} clubs\n`);

    // 读取 MongoDB
    const dbClubs = await Club.find({}).lean();
    console.log(`💾 Database loaded: ${dbClubs.length} clubs\n`);

    // 创建映射表
    const dbMap = new Map();
    const jsonMap = new Map();
    const nameMap = new Map();

    dbClubs.forEach(club => {
      const id = club._id.toString();
      dbMap.set(id, club);
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      nameMap.set(key, { db: club });
    });

    jsonData.forEach(club => {
      jsonMap.set(club.id, club);
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      if (nameMap.has(key)) {
        nameMap.get(key).json = club;
      } else {
        nameMap.set(key, { json: club });
      }
    });

    // 找出不一致的
    console.log('🔍 Checking for differences...\n');
    let foundDiff = false;

    for (const [key, data] of nameMap) {
      if (data.db && data.json) {
        if (data.db._id.toString() === data.json.id) {
          const differences = findDifferences(data.db, data.json);
          if (differences.length > 0) {
            foundDiff = true;
            console.log(`❌ ${data.db.name} (${data.db.school})`);
            console.log(`   ID: ${data.db._id}\n`);
            
            differences.forEach(diff => {
              console.log(`   Field: ${diff.field}`);
              console.log(`   Database:  ${JSON.stringify(diff.database)}`);
              console.log(`   JSON:      ${JSON.stringify(diff.json)}`);
              console.log();
            });
          }
        }
      }
    }

    if (!foundDiff) {
      console.log('✅ No differences found! Database and JSON are in sync.');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
