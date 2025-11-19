const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

// 🔐 Variables de entorno (se configuran en Railway)
const TOKEN = process.env.WHATSAPP_TOKEN; // tu token de acceso de Meta
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // 871507329381386
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'ysacc123';

// ✅ Endpoint simple para probar que está vivo
app.get('/', (req, res) => {
  res.send('WhatsApp Bot funcionando ✅');
});

// ✅ Verificación de Webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    } else {
      console.log('❌ Token de verificación no válido');
      return res.sendStatus(403);
    }
  }

  res.sendStatus(404);
});

// ✅ Recepción de mensajes (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('📩 Webhook recibido:', JSON.stringify(body, null, 2));

    const entry = body.entry && body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from; // número del usuario
      const text = message.text && message.text.body;

      console.log(`💬 Mensaje de ${from}: ${text}`);

      let respuesta =
        'No entendí tu mensaje. Escribe *menu* para ver opciones.';

      if (text) {
        const t = text.toLowerCase().trim();
        if (t === 'hola') {
          respuesta =
            'Hola 👋, soy el bot de la empresa. Escribe *menu* para ver opciones.';
        } else if (t === 'menu') {
          respuesta =
            '📋 Menú:\n1️⃣ Horarios\n2️⃣ Servicios\n3️⃣ Hablar con un asesor';
        } else if (t === '1') {
          respuesta =
            '🕒 Nuestro horario es de lunes a viernes de 9:00 a 18:00.';
        } else if (t === '2') {
          respuesta =
            '💼 Ofrecemos desarrollo web, sistemas multitenant y soluciones a medida.';
        } else if (t === '3') {
          respuesta = '👨‍💻 Un asesor se pondrá en contacto contigo pronto.';
        }
      }

      await enviarMensajeTexto(from, respuesta);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook:', err.message);
    res.sendStatus(500);
  }
});

// 🔧 Función para enviar mensajes de texto
async function enviarMensajeTexto(to, message) {
  if (!TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ Falta TOKEN o PHONE_NUMBER_ID en variables de entorno');
    return;
  }

  const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

  try {
    const response = await axios({
      method: 'POST',
      url,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to,
        text: { body: message },
      },
    });

    console.log('✅ Mensaje enviado:', response.data);
  } catch (error) {
    console.error(
      '❌ Error al enviar mensaje:',
      error.response?.data || error.message
    );
  }
}

// 🚀 Railway usa process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
