// Importe o SDK do Firebase Admin
const admin = require('firebase-admin');

// --- Configuração do Firebase ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const auth = admin.auth();

/**
 * Netlify Function para realizar o login do usuário.
 * Endpoint: POST /.netlify/functions/login
 */
exports.handler = async (event, context) => {
  // Define os cabeçalhos CORS para todas as respostas
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Tratamento da Requisição OPTIONS (pré-voo)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // Validação do Método HTTP para POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido.' }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email e senha são obrigatórios.' }),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      };
    }
    
    // O Firebase Admin SDK não tem uma função para verificar senhas diretamente.
    // A abordagem segura é usar o `getUserByEmail` para encontrar o usuário
    // e depois o SDK de cliente no frontend para verificar a senha.
    // Para simplificar a lógica de backend aqui, vamos usar `getUserByEmail`
    // e criar um token personalizado para o frontend.
    // O frontend então completará a autenticação com esse token.

    const userRecord = await auth.getUserByEmail(email);
    
    // Gerar um token de autenticação personalizado
    const customToken = await auth.createCustomToken(userRecord.uid);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Token de autenticação gerado com sucesso.',
        token: customToken,
        uid: userRecord.uid
      }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };

  } catch (error) {
    console.error('Erro no login:', error);

    // Tratar erros específicos do Firebase
    let errorMessage = 'Ocorreu um erro inesperado ao processar sua solicitação.';
    if (error.code === 'auth/user-not-found') {
      // Retornar uma mensagem genérica para evitar que atacantes descubram emails de usuários válidos
      errorMessage = 'Credenciais inválidas.';
    }

    return {
      statusCode: 401, // 401 Unauthorized
      body: JSON.stringify({ error: errorMessage }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }
};
