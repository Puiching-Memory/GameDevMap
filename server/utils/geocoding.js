const fetch = require('node-fetch');
require('dotenv').config();

/**
 * AMap Geocoding Utility
 * 
 * 使用高德地图API验证坐标与地址的匹配度
 */

const AMAP_KEY = process.env.AMAP_KEY;
const GEOCODE_API = 'https://restapi.amap.com/v3/geocode/geo';

/**
 * 验证坐标是否与地址匹配
 * 
 * @param {string} address - 地址字符串（省份 + 城市 + 学校）
 * @param {Array<number>} coordinates - [经度, 纬度]
 * @param {number} radiusKm - 允许的误差半径（公里）
 * @returns {Promise<{verified: boolean, distance: number, geocodedCoords: Array}>}
 */
async function verifyCoordinates(address, coordinates, radiusKm = 10) {
  try {
    if (!AMAP_KEY) {
      console.warn('⚠️ AMAP_KEY not configured, skipping geocoding verification');
      return {
        verified: false,
        error: 'AMAP_KEY not configured',
        distance: null,
        geocodedCoords: null
      };
    }

    // 调用高德地图地理编码API
    const url = `${GEOCODE_API}?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geocoding API failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
      return {
        verified: false,
        error: 'Address not found',
        distance: null,
        geocodedCoords: null
      };
    }

    // 获取地理编码返回的坐标
    const geocode = data.geocodes[0];
    const [geocodedLng, geocodedLat] = geocode.location.split(',').map(Number);

    // 计算两点之间的距离
    const distance = calculateDistance(
      coordinates[1], coordinates[0], // [lng, lat] -> lat, lng
      geocodedLat, geocodedLng
    );

    const verified = distance <= radiusKm;

    return {
      verified,
      distance: Math.round(distance * 100) / 100, // 保留2位小数
      geocodedCoords: [geocodedLng, geocodedLat],
      address: geocode.formatted_address
    };

  } catch (error) {
    console.error('Geocoding verification failed:', error);
    return {
      verified: false,
      error: error.message,
      distance: null,
      geocodedCoords: null
    };
  }
}

/**
 * 计算两个经纬度坐标之间的距离（Haversine公式）
 * 
 * @param {number} lat1 - 纬度1
 * @param {number} lon1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lon2 - 经度2
 * @returns {number} 距离（公里）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（公里）
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * 角度转弧度
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * 根据地址获取坐标建议
 * 
 * @param {string} address - 地址字符串
 * @returns {Promise<Array<number>>} [经度, 纬度]
 */
async function getCoordinatesSuggestion(address) {
  try {
    if (!AMAP_KEY) {
      throw new Error('AMAP_KEY not configured');
    }

    const url = `${GEOCODE_API}?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geocoding API failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
      throw new Error('Address not found');
    }

    const geocode = data.geocodes[0];
    const [lng, lat] = geocode.location.split(',').map(Number);

    return {
      coordinates: [lng, lat],
      formattedAddress: geocode.formatted_address,
      level: geocode.level
    };

  } catch (error) {
    console.error('Get coordinates suggestion failed:', error);
    throw error;
  }
}

module.exports = {
  verifyCoordinates,
  getCoordinatesSuggestion,
  calculateDistance
};
