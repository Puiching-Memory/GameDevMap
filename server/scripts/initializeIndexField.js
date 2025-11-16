/**
 * 初始化 index 字段脚本
 * 功能：为所有现有的 Club 文档添加 index 字段（如果不存在）
 * 用法：node server/scripts/initializeIndexField.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// 导入 Club 模型
const Club = require('../models/Club');

// 数据库连接
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-dev-map', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB 已连接');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

// 初始化 index 字段
const initializeIndexField = async () => {
  try {
    // 获取所有没有 index 字段的文档
    const clubsWithoutIndex = await Club.find({ index: { $exists: false } });
    
    if (clubsWithoutIndex.length === 0) {
      console.log('✅ 所有文档都已有 index 字段');
      return;
    }

    console.log(`📊 找到 ${clubsWithoutIndex.length} 个文档需要初始化 index 字段`);

    // 为每个文档分配 index 值
    const maxIndex = await Club.findOne({}).sort({ index: -1 }).select('index');
    let startIndex = (maxIndex && maxIndex.index) ? maxIndex.index + 1 : 0;

    for (let i = 0; i < clubsWithoutIndex.length; i++) {
      const club = clubsWithoutIndex[i];
      club.index = startIndex + i;
      await club.save();
      console.log(`✏️  已更新 ${club.name} (${club.school}) - index: ${club.index}`);
    }

    console.log(`✅ 已成功初始化 ${clubsWithoutIndex.length} 个文档的 index 字段`);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
};

// 验证 index 字段的连续性
const validateIndexField = async () => {
  try {
    const clubs = await Club.find({}).select('name school index').sort({ index: 1 });
    
    console.log('\n📋 验证 index 字段连续性：');
    
    let hasGaps = false;
    let prevIndex = -1;

    for (const club of clubs) {
      if (club.index === undefined || club.index === null) {
        console.warn(`⚠️  ${club.name} (${club.school}) 没有 index 字段`);
        hasGaps = true;
      } else if (club.index !== prevIndex + 1 && prevIndex >= 0) {
        console.warn(`⚠️  index 字段有间隙: ${prevIndex} -> ${club.index}`);
        hasGaps = true;
      }
      prevIndex = club.index || prevIndex;
    }

    if (!hasGaps) {
      console.log('✅ index 字段连续性验证通过');
    }
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
};

// 主函数
const main = async () => {
  console.log('🚀 开始初始化 index 字段...\n');
  
  await connectDB();
  await initializeIndexField();
  await validateIndexField();
  
  console.log('\n✅ 脚本执行完成');
  process.exit(0);
};

// 执行脚本
main();
