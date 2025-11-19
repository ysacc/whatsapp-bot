/**
 * index_clinica.js
 * Chatbot para CLÍNICA:
 * - Pedir cita
 * - Revisar cita
 * - Ubicación
 * - Guarda en Sheets (SHEETS_WEBHOOK_URL)
 * - Llama a API (API_BASE_URL_CLINIC)
 * - Notifica por email via EMAIL_WEBHOOK_URL (Apps Script)
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const API_BASE_URL_CLINIC = process.env.API_BASE_URL_CLINIC || '';
const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL || '';

const sessions = new Map();

// Helpers WhatsApp
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
    console.log('📤 Ubicación clínica enviada:', name);
  } catch (err) {
    console.error(
      '❌ Error enviando ubicación clínica:',
      err.response?.data || err.message
    );
  }
}

// Sheets
async function guardarEnSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn(
      '⚠️ SHEETS_WEBHOOK_URL no configurado. No se guardará en Sheets (clínica).'
    );
    return;
  }
  try {
    const resp = await axios.post(SHEETS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('📝 Cita clínica guardada en Sheets:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error guardando en Sheets (clínica):',
      err.response?.data || err.message
    );
  }
}

// API Clínica (citas)
async function crearCitaEnAPI(cita) {
  if (!API_BASE_URL_CLINIC) {
    console.warn('⚠️ API_BASE_URL_CLINIC no configurada. Solo log.');
    console.log('Cita (mock) ->', cita);
    return { ok: true, codigo: 'CITA-MOCK-12345' };
  }
  try {
    const resp = await axios.post(`${API_BASE_URL_CLINIC}/appointments`, cita, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('✅ Cita creada en API clínica:', resp.data);
    return resp.data;
  } catch (err) {
    console.error(
      '❌ Error creando cita en API clínica:',
      err.response?.data || err.message
    );
    return { ok: false };
  }
}

async function consultarCitaEnAPI(identificador) {
  if (!API_BASE_URL_CLINIC) {
    console.warn(
      '⚠️ API_BASE_URL_CLINIC no configurada. Respuesta mock de estado.'
    );
    return {
      ok: true,
      estado: 'Pendiente de confirmación',
      fecha: 'Por confirmar',
      medico: 'Por asignar',
    };
  }
  try {
    const resp = await axios.get(
      `${API_BASE_URL_CLINIC}/appointments/${encodeURIComponent(identificador)}`
    );
    console.log('ℹ️ Estado de cita desde API:', resp.data);
    return resp.data;
  } catch (err) {
    console.error(
      '❌ Error consultando cita en API clínica:',
      err.response?.data || err.message
    );
    return { ok: false };
  }
}

// Email (Apps Script u otro webhook)
async function notificarCitaPorEmail(cita) {
  if (!EMAIL_WEBHOOK_URL) {
    console.warn(
      '⚠️ EMAIL_WEBHOOK_URL no configurada. No se enviará correo de notificación.'
    );
    return;
  }
  try {
    const resp = await axios.post(EMAIL_WEBHOOK_URL, cita, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('📧 Notificación de cita enviada:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error enviando notificación de cita por email:',
      err.response?.data || err.message
    );
  }
}

// Flujo
function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, { stage: 'MENU' });
  }
  return sessions.get(from);
}

function menuClinica() {
  return (
    '🏥 *Clínica Salud Plus*\n\n' +
    '¿Qué deseas hacer?\n\n' +
    '1️⃣ Pedir una cita\n' +
    '2️⃣ Revisar estado de mi cita\n' +
    '3️⃣ Ver ubicación de la clínica\n' +
    '4️⃣ Hablar con un asesor\n\n' +
    'Responde con un número.\n' +
    'En cualquier momento puedes escribir *menu*.'
  );
}

// Rutas
app.get('/', (req, res) => res.send('Chatbot clínica listo 🏥'));

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

    if (
      ['menu', 'menú', 'hola', 'inicio', 'cita'].includes(lower) ||
      state.stage === 'MENU'
    ) {
      state.stage = 'WAIT_OPTION';
      await sendText(from, menuClinica());
      return res.sendStatus(200);
    }

    if (state.stage === 'WAIT_OPTION') {
      if (text === '1') {
        state.stage = 'ASK_NAME';
        await sendText(from, 'Perfecto 🩺 ¿Cuál es tu nombre completo?');
      } else if (text === '2') {
        state.stage = 'ASK_ID_CITA';
        await sendText(
          from,
          'Por favor, indícame tu DNI o el código de cita que te enviamos.'
        );
      } else if (text === '3') {
        await sendLocation(
          from,
          -12.046374,
          -77.042793,
          'Clínica Salud Plus',
          'Av. Salud 123, Lima'
        );
      } else if (text === '4') {
        await sendText(
          from,
          'Un asesor de la clínica se pondrá en contacto contigo en breve. Puedes dejar tu número o correo.'
        );
      } else {
        await sendText(
          from,
          'Opción no válida. Escribe *menu* para ver opciones.'
        );
      }
      return res.sendStatus(200);
    }

    // Crear cita
    if (state.stage === 'ASK_NAME') {
      state.nombre = text;
      state.stage = 'ASK_SERVICE';
      await sendText(
        from,
        '¿Para qué especialidad deseas la cita? (ej: cardiología, pediatría, medicina general)'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_SERVICE') {
      state.especialidad = text;
      state.stage = 'ASK_DATE';
      await sendText(
        from,
        '¿Para qué día y rango de hora te gustaría la cita? (ej: 25/11 en la mañana)'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_DATE') {
      state.fechaDeseada = text;
      state.stage = 'ASK_CONTACT';
      await sendText(
        from,
        'Por último, ¿a qué número o correo podemos confirmar tu cita?'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_CONTACT') {
      const cita = {
        negocio_tipo: 'clinica',
        wa_from: from,
        nombre: state.nombre,
        especialidad: state.especialidad,
        fecha_deseada: state.fechaDeseada,
        contacto: text,
        canal: 'whatsapp',
      };

      guardarEnSheets(cita);
      const resultadoAPI = await crearCitaEnAPI(cita);

      if (resultadoAPI.ok) {
        cita.codigo_cita = resultadoAPI.codigo || 'SIN-CODIGO';
      }

      notificarCitaPorEmail(cita);

      await sendText(
        from,
        '✅ Hemos registrado tu solicitud de cita. Nuestro equipo te confirmará la disponibilidad y horario exacto.'
      );

      sessions.delete(from);
      return res.sendStatus(200);
    }

    // Revisar cita
    if (state.stage === 'ASK_ID_CITA') {
      const identificador = text;
      const estado = await consultarCitaEnAPI(identificador);

      if (estado.ok !== false) {
        await sendText(
          from,
          `📋 Estado de tu cita:\n\nEstado: ${estado.estado}\nFecha: ${estado.fecha}\nMédico: ${estado.medico}`
        );
      } else {
        await sendText(
          from,
          'No pudimos encontrar tu cita con ese dato. Un asesor te ayudará a revisar manualmente.'
        );
      }

      sessions.delete(from);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook clínica:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏥 Chatbot clínica escuchando en puerto ${PORT}`);
});
