import mongoose from 'mongoose';

const configSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Config key is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Config value is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Atualizar updatedAt antes de salvar
configSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Método estático para buscar configuração por key
configSchema.statics.getByKey = async function (key) {
  return this.findOne({ key: key.toLowerCase() });
};

// Método estático para atualizar ou criar configuração
configSchema.statics.upsert = async function (key, value, description = '') {
  return this.findOneAndUpdate(
    { key: key.toLowerCase() },
    { value, description, updatedAt: Date.now() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Método estático para buscar todas as configurações
configSchema.statics.getAll = async function () {
  return this.find({}).sort({ key: 1 });
};

const Config = mongoose.model('Config', configSchema);

export default Config;

