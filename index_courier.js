/**
 * index_courier.js
 * Chatbot para COURIER:
 * - Consultar estado de envío por código
 * - Ver última ubicación (si API devuelve coordenadas)
 * - Guarda consultas en Sheets (SHEETS_WEBHOOK_URL)
 * - Conexión a API tracking (API_BASE_URL_COURIER)
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const API_BASE_URL_COURIER = process.env.API_BASE_URL_COURIER || '';

const sessions = new Map();

// WhatsApp helpers
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
        location: { latitude: lat, longitude: lng, name, address },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('📤 Ubicación paquete enviada:', name);
  } catch (err) {
    console.error(
      '❌ Error enviando ubicación paquete:',
      err.response?.data || err.message
    );
  }
}

// Sheets
async function guardarEnSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn(
      '⚠️ SHEETS_WEBHOOK_URL no configurado. No se guardará en Sheets (courier).'
    );
    return;
  }
  try {
    const resp = await axios.post(SHEETS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('📝 Consulta courier guardada en Sheets:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error guardando en Sheets (courier):',
      err.response?.data || err.message
    );
  }
}

// API Courier
async function consultarEnvioEnAPI(codigo) {
  if (!API_BASE_URL_COURIER) {
    console.warn('⚠️ API_BASE_URL_COURIER no configurada. Respuesta mock.');
    return {
      ok: true,
      codigo,
      estado: 'En tránsito',
      ultima_actualizacion: 'Hoy',
      ubicacion: 'Centro de distribución principal',
      lat: -12.046374,
      lng: -77.042793,
    };
  }
  try {
    const resp = await axios.get(
      `${API_BASE_URL_COURIER}/tracking/${encodeURIComponent(codigo)}`
    );
    console.log('ℹ️ Datos tracking desde API:', resp.data);
    return resp.data;
  } catch (err) {
    console.error(
      '❌ Error consultando envío en API courier:',
      err.response?.data || err.message
    );
    return { ok: false };
  }
}

// Flujo
function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, { stage: 'ASK_CODE' });
  }
  return sessions.get(from);
}

app.get('/', (req, res) => res.send('Chatbot courier listo 🚚'));

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

    if (['menu', 'menú', 'hola', 'envío', 'envio'].includes(lower)) {
      state.stage = 'ASK_CODE';
      await sendText(
        from,
        '🚚 *Bienvenido a Courier Express*\n\n' +
          'Por favor, envíame tu *código de seguimiento* para revisar el estado de tu envío.'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_CODE') {
      const codigo = text;

      const consulta = {
        negocio_tipo: 'courier',
        wa_from: from,
        codigo_tracking: codigo,
        canal: 'whatsapp',
      };
      guardarEnSheets(consulta);

      const info = await consultarEnvioEnAPI(codigo);

      if (info.ok) {
        await sendText(
          from,
          `📦 Estado de tu envío (${codigo}):\n\n` +
            `Estado: ${info.estado}\n` +
            `Última actualización: ${info.ultima_actualizacion}\n` +
            `Ubicación: ${info.ubicacion}`
        );

        if (info.lat && info.lng) {
          await sendLocation(
            from,
            info.lat,
            info.lng,
            'Última ubicación registrada',
            info.ubicacion
          );
        }
      } else {
        await sendText(
          from,
          'No pudimos encontrar un envío con ese código. Verifica el número o intenta más tarde.'
        );
      }

      sessions.delete(from);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook courier:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚚 Chatbot courier escuchando en puerto ${PORT}`);
});
