import jwt from 'jsonwebtoken';
import Joi from 'joi';
import User from '../models/User.js';

// Validation schemas
const registerSchema = Joi.object({
  nickname: Joi.string().min(3).max(20).required().messages({
    'string.min': 'Nickname must be at least 3 characters',
    'string.max': 'Nickname must be less than 20 characters',
    'any.required': 'Nickname is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
  age: Joi.number().min(13).max(120).required().messages({
    'number.min': 'You must be at least 13 years old',
    'number.max': 'Invalid age',
    'any.required': 'Age is required',
  }),
  location: Joi.object({
    city: Joi.string().allow('').optional(),
    state: Joi.string().allow('').optional(),
    country: Joi.string().allow('').optional(),
  }).optional(),
  avatar: Joi.string().uri().allow('').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// Generate JWT token
const generateToken = userId => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d', // 7 days
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { nickname, email, password, age, location, avatar } = value;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { nickname }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }
      if (existingUser.nickname === nickname) {
        return res.status(409).json({
          success: false,
          message: 'Nickname already taken',
        });
      }
    }

    // Create user
    const user = await User.create({
      nickname,
      email,
      password,
      age,
      location: location || {},
      avatar: avatar || '',
    });

    // Generate token
    const token = generateToken(user._id);

    // Return user data and token
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = value;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update user status
    user.isOnline = true;
    await user.updateLastActive();

    // Generate token
    const token = generateToken(user._id);

    // Return user data and token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Verify token and get current user
// @route   GET /api/auth/verify
// @access  Private
export const verify = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update last active
    await user.updateLastActive();

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        user: user.toPublicJSON(),
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (user) {
      user.isOnline = false;
      await user.updateLastActive();
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
