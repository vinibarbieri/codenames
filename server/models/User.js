import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    nickname: {
      type: String,
      required: [true, 'Nickname is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Nickname must be at least 3 characters'],
      maxlength: [20, 'Nickname must be less than 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [13, 'You must be at least 13 years old'],
      max: [120, 'Invalid age'],
    },
    location: {
      city: {
        type: String,
        trim: true,
        default: '',
      },
      state: {
        type: String,
        trim: true,
        default: '',
      },
      country: {
        type: String,
        trim: true,
        default: '',
      },
    },
    avatar: {
      type: String,
      default: '',
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified or new
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

// Method to get public profile (without sensitive data)
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    nickname: this.nickname,
    email: this.email,
    age: this.age,
    location: this.location,
    avatar: this.avatar,
    score: this.score,
    role: this.role,
    isOnline: this.isOnline,
    lastActive: this.lastActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Update lastActive timestamp
userSchema.methods.updateLastActive = function () {
  this.lastActive = Date.now();
  return this.save();
};

const User = mongoose.model('User', userSchema);

export default User;
