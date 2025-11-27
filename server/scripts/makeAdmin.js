import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

// Obter caminho absoluto do diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
// O .env está na raiz do projeto (2 níveis acima de server/scripts/)
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

/**
 * Script para tornar um usuário admin
 * Uso: node server/scripts/makeAdmin.js <email ou nickname>
 * Exemplo: node server/scripts/makeAdmin.js admin@example.com
 * Exemplo: node server/scripts/makeAdmin.js meuusuario
 */
async function makeAdmin() {
  try {
    // Verificar argumentos
    const identifier = process.argv[2];
    
    if (!identifier) {
      console.error('❌ Erro: Forneça o email ou nickname do usuário');
      console.log('Uso: node server/scripts/makeAdmin.js <email ou nickname>');
      process.exit(1);
    }

    // Obter MONGODB_URI do .env ou usar fallback
    let MONGO_URI = process.env.MONGODB_URI;
    
    // Remover aspas se houver
    if (MONGO_URI) {
      MONGO_URI = MONGO_URI.replace(/^["']|["']$/g, '');
    }
    
    // Se não encontrou no .env, usar fallback
    if (!MONGO_URI) {
      console.warn('⚠️  MONGODB_URI não encontrado no .env, usando fallback...');
      MONGO_URI = 'mongodb://localhost:27017/codenames';
    }

    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado ao MongoDB');

    // Buscar usuário por email ou nickname
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { nickname: identifier }
      ]
    });

    if (!user) {
      console.error(`❌ Usuário não encontrado: ${identifier}`);
      console.log('💡 Dica: Verifique se o email ou nickname está correto');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Verificar se já é admin
    if (user.role === 'admin') {
      console.log(`ℹ️  O usuário ${user.nickname} (${user.email}) já é admin`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Atualizar role para admin
    user.role = 'admin';
    await user.save();

    console.log('✅ Usuário atualizado com sucesso!');
    console.log(`   Nickname: ${user.nickname}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user._id}`);

    // Desconectar
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao tornar usuário admin:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Executar script
makeAdmin();

