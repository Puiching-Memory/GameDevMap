const mongoose = require('mongoose');
require('dotenv').config();

console.log('MONGODB_URI:', process.env.MONGODB_URI ? '已设置' : '未设置');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI 环境变量未设置');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ 数据库连接成功');
  return mongoose.connection.close();
})
.then(() => {
  console.log('✅ 数据库连接已关闭');
  process.exit(0);
})
.catch(error => {
  console.error('❌ 数据库连接失败:', error.message);
  process.exit(1);
});