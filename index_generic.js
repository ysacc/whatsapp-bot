/**
 * index_generic.js
 * PLANTILLA COMPLETA PARA CHATBOTS WHATSAPP GENÉRICOS
 *
 * Usa el flujo modular: genericFlow.js
 * Usa helpers: enviar texto, documentos, imágenes, ubicación.
 *
 * Este archivo NO interfiere con tu index.js principal.
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const { createGenericFlow } = require('./genericFlow');

const app = express().use(bodyParser.json());

// 🔐 Variables de entorno
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';

// Helpers con WhatsApp Cloud API
async function sendText(to, message) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios({
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
    console.log('📤 Texto enviado:', to);
  } catch (err) {
    console.error(
      '❌ Error enviando texto:',
      err.response?.data || err.message
    );
  }
}

async function sendDocument(to, documentUrl, caption, filename) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios({
      method: 'POST',
      url,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          link: documentUrl,
          caption: caption || '',
          filename: filename || 'archivo.pdf',
        },
      },
    });
    console.log('📤 Documento enviado:', filename);
  } catch (err) {
    console.error(
      '❌ Error enviando documento:',
      err.response?.data || err.message
    );
  }
}

async function sendImage(to, imageUrl, caption) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios({
      method: 'POST',
      url,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: { link: imageUrl, caption },
      },
    });
    console.log('📤 Imagen enviada:', imageUrl);
  } catch (err) {
    console.error(
      '❌ Error enviando imagen:',
      err.response?.data || err.message
    );
  }
}

async function sendLocation(to, lat, lng, name, address) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios({
      method: 'POST',
      url,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to,
        type: 'location',
        location: {
          latitude: lat,
          longitude: lng,
          name,
          address,
        },
      },
    });

    console.log('📤 Ubicación enviada:', name);
  } catch (err) {
    console.error(
      '❌ Error enviando ubicación:',
      err.response?.data || err.message
    );
  }
}

// Inicializar flujo genérico
const flow = createGenericFlow({
  sendText,
  sendDocument,
  sendLocation,
});

// ===========================
// 🌐 ENDPOINTS DEL WEBHOOK
// ===========================

// Probar servidor
app.get('/', (req, res) => {
  res.send('Chatbot genérico WhatsApp listo 🚀');
});

// Verificación webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado correctamente.');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(404);
});

// Recepción mensajes (POST)
app.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || '';

      console.log(`💬 Mensaje de ${from}: ${text}`);

      const respuesta = await flow.handleMessage(from, text);

      if (respuesta) {
        await sendText(from, respuesta);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook:', err.message);
    res.sendStatus(500);
  }
});

// ===========================
// 🚀 INICIAR SERVIDOR
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('======================================================');
  console.log('🚀 SERVIDOR INICIADO (GENÉRICO)');
  console.log(`🌐 Puerto: ${PORT}`);
  console.log('======================================================');
});
