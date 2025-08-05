// Importe o SDK do Firebase Admin
const admin = require('firebase-admin');

// --- Configuração do Firebase ---
// Você precisa inicializar o app do Firebase apenas uma vez.
// As credenciais da sua conta de serviço devem ser armazenadas como Variáveis de Ambiente no Netlify.
// NUNCA coloque suas credenciais diretamente no código.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL // Ex: "https://seu-projeto-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();
const auth = admin.auth();

/**
 * Netlify Function para cadastrar um novo usuário.
 * Endpoint: POST /.netlify/functions/register
 */
exports.handler = async (event, context) => {
  // 1. Validação do Método HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    // 2. Parse do corpo da requisição
    const {
      userType, // 'freelancer' ou 'contratante'
      email,
      password, // O ideal é que a senha seja enviada pelo frontend
      nomeCompleto,
      celular,
      cpf,
      rg,
      cep,
      servicos // Apenas para freelancers
    } = JSON.parse(event.body);

    // 3. Validação dos dados de entrada
    if (!userType || !['freelancer', 'contratante'].includes(userType)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'O campo "userType" é obrigatório e deve ser "freelancer" ou "contratante".' }) };
    }
    if (!email || !password || !nomeCompleto || !celular || !cpf) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Campos obrigatórios ausentes: email, password, nomeCompleto, celular, cpf.' }) };
    }
    if (userType === 'freelancer' && !servicos) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Para o tipo "freelancer", o campo "servicos" é obrigatório.' }) };
    }


    // 4. Criar usuário no Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: nomeCompleto,
      phoneNumber: `+55${celular}` // Padrão E.164, assumindo DDI do Brasil
    });

    const uid = userRecord.uid;

    // 5. Preparar dados para salvar no Realtime Database
    const userData = {
      uid: uid,
      userType: userType,
      nomeCompleto: nomeCompleto,
      email: email,
      celular: celular,
      cpf: cpf,
      rg: rg || null, // RG e CEP são opcionais
      cep: cep || null,
      createdAt: new Date().toISOString()
    };

    // Adiciona o campo de serviços apenas se for freelancer
    if (userType === 'freelancer') {
      userData.servicos = servicos;
    }

    // 6. Salvar dados no Realtime Database
    await db.ref(`users/${uid}`).set(userData);

    // 7. Retornar sucesso
    return {
      statusCode: 201, // 201 Created
      body: JSON.stringify({
        message: 'Usuário cadastrado com sucesso!',
        uid: uid,
        user: userData
      }),
      headers: { 'Content-Type': 'application/json' },
    };

  } catch (error) {
    console.error('Erro no cadastro:', error);

    // Tratar erros específicos do Firebase
    const errorMessage = error.code === 'auth/email-already-exists'
      ? 'O email fornecido já está em uso.'
      : 'Ocorreu um erro inesperado ao processar sua solicitação.';

    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage, details: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
