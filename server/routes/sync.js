const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Club = require('../models/Club');
const { authenticate } = require('../middleware/auth');
const syncToJson = require('../scripts/syncToJson');

/**
 * 格式化 Club 对象为标准格式
 */
function formatClub(club) {
  return {
    id: club._id ? club._id.toString() : club.id,
    name: club.name,
    school: club.school,
    city: club.city || '',
    province: club.province,
    latitude: club.coordinates ? club.coordinates[1] : club.latitude,
    longitude: club.coordinates ? club.coordinates[0] : club.longitude,
    img_name: club.logo || club.img_name || '',
    short_description: club.shortDescription || club.short_description || '',
    long_description: club.description || club.long_description || '',
    tags: club.tags || [],
    website: club.website || '',
    contact: club.contact || {}
  };
}

/**
 * GET /api/sync/compare
 * 对比数据库和JSON文件中的数据
 */
router.get('/compare', authenticate, async (req, res) => {
  try {
    // 读取 MongoDB 数据
    const dbClubs = await Club.find({}).lean();
    
    // 读取 JSON 文件数据
    const jsonPath = path.resolve(__dirname, '../../public/data/clubs.json');
    let jsonClubs = [];
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      jsonClubs = JSON.parse(jsonData);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'JSON_NOT_FOUND',
        message: 'clubs.json 文件不存在'
      });
    }

    // 创建映射表
    const dbMap = new Map();
    const jsonMap = new Map();
    const nameMap = new Map(); // 用于按名称匹配

    dbClubs.forEach(club => {
      const formatted = formatClub(club);
      dbMap.set(formatted.id, formatted);
      const key = `${formatted.name.toLowerCase()}-${formatted.school.toLowerCase()}`;
      nameMap.set(key, { db: formatted });
    });

    jsonClubs.forEach(club => {
      jsonMap.set(club.id, club);
      const key = `${club.name.toLowerCase()}-${club.school.toLowerCase()}`;
      if (nameMap.has(key)) {
        nameMap.get(key).json = club;
      } else {
        nameMap.set(key, { json: club });
      }
    });

    // 分类结果
    const result = {
      identical: [],      // 完全相同
      different: [],      // 存在差异
      dbOnly: [],        // 仅在数据库中
      jsonOnly: [],      // 仅在JSON中
      conflicts: []      // 名称相同但ID不同（可能的冲突）
    };

    // 按名称比对
    for (const [key, data] of nameMap) {
      if (data.db && data.json) {
        if (data.db.id === data.json.id) {
          // ID相同，检查内容是否相同
          const dbStr = JSON.stringify(data.db);
          const jsonStr = JSON.stringify(data.json);
          
          if (dbStr === jsonStr) {
            result.identical.push({
              club: data.db,
              source: 'both'
            });
          } else {
            result.different.push({
              db: data.db,
              json: data.json,
              differences: findDifferences(data.db, data.json)
            });
          }
        } else {
          // 名称相同但ID不同，可能是冲突
          result.conflicts.push({
            db: data.db,
            json: data.json,
            reason: 'Same name but different ID'
          });
        }
      } else if (data.db && !data.json) {
        result.dbOnly.push(data.db);
      } else if (!data.db && data.json) {
        result.jsonOnly.push(data.json);
      }
    }

    // 统计信息
    const stats = {
      database: {
        total: dbClubs.length,
        unique: dbMap.size
      },
      json: {
        total: jsonClubs.length,
        unique: jsonMap.size
      },
      comparison: {
        identical: result.identical.length,
        different: result.different.length,
        dbOnly: result.dbOnly.length,
        jsonOnly: result.jsonOnly.length,
        conflicts: result.conflicts.length
      }
    };

    return res.json({
      success: true,
      data: {
        stats,
        details: result
      }
    });

  } catch (error) {
    console.error('❌ Compare failed:', error);
    return res.status(500).json({
      success: false,
      error: 'COMPARE_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/merge
 * 执行智能合并
 */
router.post('/merge', authenticate, async (req, res) => {
  try {
    const result = await syncToJson('merge');
    
    return res.json({
      success: true,
      message: '智能合并完成',
      data: result
    });

  } catch (error) {
    console.error('❌ Merge failed:', error);
    return res.status(500).json({
      success: false,
      error: 'MERGE_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/sync/replace
 * 执行完全替换
 */
router.post('/replace', authenticate, async (req, res) => {
  try {
    const result = await syncToJson('replace');
    
    return res.json({
      success: true,
      message: '完全替换完成',
      data: result
    });

  } catch (error) {
    console.error('❌ Replace failed:', error);
    return res.status(500).json({
      success: false,
      error: 'REPLACE_FAILED',
      message: error.message
    });
  }
});

/**
 * 查找两个对象之间的差异
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      differences.push({
        field: key,
        database: val1,
        json: val2
      });
    }
  }
  
  return differences;
}

module.exports = router;
