/**
 * index_restaurante.js
 * Chatbot para RESTAURANTE: pedidos, reservas, menú, ubicación.
 * - Guarda pedidos y reservas en Google Sheets (SHEETS_WEBHOOK_URL)
 * - Llama a API para registrar pedidos (API_BASE_URL_RESTAURANT)
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const API_BASE_URL_RESTAURANT = process.env.API_BASE_URL_RESTAURANT || '';

const sessions = new Map();

// ---------- Helpers WhatsApp ----------

async function sendText(to, body) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('📤 Texto enviado:', to);
  } catch (err) {
    console.error(
      '❌ Error enviando texto:',
      err.response?.data || err.message
    );
  }
}

async function sendLocation(to, lat, lng, name, address) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  try {
    await axios.post(
      url,
      {
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
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('📤 Ubicación enviada:', name);
  } catch (err) {
    console.error(
      '❌ Error enviando ubicación:',
      err.response?.data || err.message
    );
  }
}

// ---------- Google Sheets ----------

async function guardarEnSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn(
      '⚠️ SHEETS_WEBHOOK_URL no está configurado. No se guardará en Sheets (restaurante).'
    );
    return;
  }
  try {
    const resp = await axios.post(SHEETS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('📝 Lead/pedido restaurante guardado en Sheets:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error guardando en Sheets (restaurante):',
      err.response?.data || err.message
    );
  }
}

// ---------- API RESTAURANTE (mock) ----------

async function registrarPedidoEnAPI(pedido) {
  if (!API_BASE_URL_RESTAURANT) {
    console.warn('⚠️ API_BASE_URL_RESTAURANT no configurada. Solo log.');
    console.log('Pedido (mock) ->', pedido);
    return;
  }
  try {
    const resp = await axios.post(
      `${API_BASE_URL_RESTAURANT}/pedidos`,
      pedido,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    console.log('✅ Pedido registrado en API restaurante:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error registrando pedido en API:',
      err.response?.data || err.message
    );
  }
}

// ---------- Flujo ----------

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, { stage: 'MENU' });
  }
  return sessions.get(from);
}

function menuPrincipal() {
  return (
    '🍽 *Bienvenido a Restaurante El Sabor*\n\n' +
    '¿Qué deseas hacer hoy?\n\n' +
    '1️⃣ Ver *menú digital*\n' +
    '2️⃣ Hacer un *pedido para delivery*\n' +
    '3️⃣ Reservar una *mesa*\n' +
    '4️⃣ Ver nuestra *ubicación*\n' +
    '5️⃣ Hablar con un asesor humano\n\n' +
    'Responde un número.\n' +
    'Escribe *menu* para volver aquí en cualquier momento.'
  );
}

// ---------- Rutas ----------

app.get('/', (req, res) => res.send('Chatbot restaurante listo 🍽'));

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(404);
});

app.post('/webhook', async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = (msg.text?.body || '').trim();
    const lower = text.toLowerCase();

    const state = getSession(from);

    // Comando global
    if (['menu', 'menú', 'inicio'].includes(lower)) {
      state.stage = 'WAIT_OPTION';
      await sendText(from, menuPrincipal());
      return res.sendStatus(200);
    }

    // Primer contacto
    if (state.stage === 'MENU') {
      state.stage = 'WAIT_OPTION';
      await sendText(from, menuPrincipal());
      return res.sendStatus(200);
    }

    // Menú opciones
    if (state.stage === 'WAIT_OPTION') {
      if (text === '1') {
        await sendText(
          from,
          '📲 Aquí tienes nuestro menú digital:\nhttps://turestaurante.com/menu'
        );
      } else if (text === '2') {
        state.stage = 'DELIVERY_NAME';
        await sendText(from, 'Perfecto 🍕 ¿A nombre de quién será el pedido?');
      } else if (text === '3') {
        state.stage = 'RESERVA_NAME';
        await sendText(from, 'Genial 🪑 ¿A nombre de quién será la reserva?');
      } else if (text === '4') {
        await sendLocation(
          from,
          -12.046374,
          -77.042793,
          'Restaurante El Sabor',
          'Calle 123, Lima'
        );
      } else if (text === '5') {
        await sendText(
          from,
          '👨‍🍳 Un asesor te contactará pronto. Gracias por escribirnos.'
        );
      } else {
        await sendText(
          from,
          'Opción no válida. Escribe *menu* para ver opciones.'
        );
      }
      return res.sendStatus(200);
    }

    // Flujo delivery
    if (state.stage === 'DELIVERY_NAME') {
      state.nombre = text;
      state.stage = 'DELIVERY_ORDER';
      await sendText(from, '¿Qué deseas pedir? 🍔🍟🍕');
      return res.sendStatus(200);
    }

    if (state.stage === 'DELIVERY_ORDER') {
      state.pedido = text;
      state.stage = 'DELIVERY_ADDRESS';
      await sendText(
        from,
        'Perfecto. ¿Cuál es tu dirección de entrega? 🏠 (calle, número, referencia)'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'DELIVERY_ADDRESS') {
      state.direccion = text;

      const pedido = {
        negocio_tipo: 'restaurante',
        flujo: 'delivery',
        wa_from: from,
        nombre: state.nombre,
        pedido: state.pedido,
        direccion: state.direccion,
        canal: 'whatsapp',
      };

      guardarEnSheets(pedido);
      registrarPedidoEnAPI(pedido);

      await sendText(
        from,
        '¡Listo! Tu pedido está siendo procesado 🚀\nTe confirmaremos el tiempo de entrega por este medio.'
      );

      sessions.delete(from);
      return res.sendStatus(200);
    }

    // Flujo reservas
    if (state.stage === 'RESERVA_NAME') {
      state.nombreReserva = text;
      state.stage = 'RESERVA_PERSONAS';
      await sendText(from, '¿Para cuántas personas será la reserva? 👨‍👩‍👧‍👦');
      return res.sendStatus(200);
    }

    if (state.stage === 'RESERVA_PERSONAS') {
      state.personas = text;
      state.stage = 'RESERVA_HORA';
      await sendText(
        from,
        '¿Para qué día y hora deseas reservar? (ejemplo: 24/11 a las 8pm) 📅'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'RESERVA_HORA') {
      state.fechaHora = text;

      const reserva = {
        negocio_tipo: 'restaurante',
        flujo: 'reserva',
        wa_from: from,
        nombre: state.nombreReserva,
        personas: state.personas,
        fecha_hora: state.fechaHora,
        canal: 'whatsapp',
      };

      guardarEnSheets(reserva);

      await sendText(
        from,
        '¡Reserva registrada! 🪑 Nuestro equipo la confirmará en breve por este mismo chat.'
      );

      sessions.delete(from);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook restaurante:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍽 Chatbot restaurante escuchando en puerto ${PORT}`);
});
