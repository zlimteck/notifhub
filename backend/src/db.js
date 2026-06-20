const mongoose = require('mongoose');

function buildUri() {
  if (process.env.MONGODB_URI) {
    // Si l'URI est fournie directement, on encode les credentials si nécessaire
    const uri = process.env.MONGODB_URI;
    // Détecter le cas password@host@host (@ dans le mot de passe non encodé)
    // On reconstruit depuis les variables individuelles si disponibles
    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASS;
    const host = process.env.MONGO_HOST || 'mongodb';
    const port = process.env.MONGO_PORT || '27017';
    const db   = process.env.MONGO_DB   || 'orveil';

    if (user && pass) {
      return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?authSource=admin`;
    }
    return uri;
  }
  return 'mongodb://localhost:27017/orveil';
}

async function connectDB() {
  const uri = buildUri();
  const MAX_RETRIES = 10;
  const DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connecté');
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`MongoDB: tentative ${attempt}/${MAX_RETRIES} échouée — retry dans ${DELAY_MS / 1000}s`);
        await new Promise(r => setTimeout(r, DELAY_MS));
      } else {
        console.error('MongoDB: impossible de se connecter après', MAX_RETRIES, 'tentatives:', err.message);
        process.exit(1);
      }
    }
  }
}

module.exports = { connectDB };
