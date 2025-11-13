const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  school: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 2 && 
               v[0] >= -180 && v[0] <= 180 && // longitude
               v[1] >= -90 && v[1] <= 90;     // latitude
      },
      message: '坐标格式错误'
    }
  },
  description: {
    type: String
  },
  shortDescription: {
    type: String
  },
  tags: {
    type: [String],
    default: []
  },
  logo: {
    type: String
  },
  externalLinks: {
    type: [{
      _id: false,  // 禁用 Mongoose 自动添加的 _id 字段
      type: { type: String },
      url: { type: String }
    }],
    default: []
  },
  
  // Audit trail fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  sourceSubmission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  },
  verifiedBy: {
    type: String
  }
});

// Index for efficient geographic queries
clubSchema.index({ coordinates: '2dsphere' });
clubSchema.index({ province: 1 });
clubSchema.index({ name: 'text', school: 'text' });

// Virtual field for `id` (maps to _id)
clubSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
clubSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
});

clubSchema.set('toObject', {
  virtuals: true
});

// Update timestamp on save
clubSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Club', clubSchema);
