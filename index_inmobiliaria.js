/**
 * index_inmobiliaria.js
 * Chatbot para INMOBILIARIA:
 * - Información de proyectos
 * - Envío de brochure PDF
 * - Guarda leads en Google Sheets (SHEETS_WEBHOOK_URL)
 * - Envía lead a API CRM (API_BASE_URL_INMO)
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const API_BASE_URL_INMO = process.env.API_BASE_URL_INMO || '';

const BROCHURE_URL = 'https://example.com/brochure-proyecto.pdf'; // <-- cambia a tu PDF real

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

async function sendDocument(to, link, caption, filename) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          link,
          caption,
          filename,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('📤 Brochure enviado:', filename);
  } catch (err) {
    console.error(
      '❌ Error enviando brochure:',
      err.response?.data || err.message
    );
  }
}

// Sheets
async function guardarEnSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn(
      '⚠️ SHEETS_WEBHOOK_URL no configurado. No se guardará en Sheets (inmobiliaria).'
    );
    return;
  }
  try {
    const resp = await axios.post(SHEETS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('📝 Lead inmobiliaria guardado en Sheets:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error guardando en Sheets (inmobiliaria):',
      err.response?.data || err.message
    );
  }
}

// API Inmobiliaria (CRM)
async function enviarLeadAAPI(lead) {
  if (!API_BASE_URL_INMO) {
    console.warn('⚠️ API_BASE_URL_INMO no configurada. Solo log.');
    console.log('Lead INMO (mock) ->', lead);
    return;
  }
  try {
    const resp = await axios.post(`${API_BASE_URL_INMO}/leads`, lead, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('✅ Lead inmobiliario enviado a API:', resp.data);
  } catch (err) {
    console.error(
      '❌ Error enviando lead a API INMO:',
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

function menuInmo() {
  return (
    '🏢 *Bienvenido a Inmobiliaria Premium*\n\n' +
    '¿En qué podemos ayudarte hoy?\n\n' +
    '1️⃣ Información de proyectos\n' +
    '2️⃣ Recibir brochure en PDF\n' +
    '3️⃣ Agendar visita a sala de ventas\n' +
    '4️⃣ Hablar con un asesor\n\n' +
    'Responde con un número.'
  );
}

// Rutas
app.get('/', (req, res) => res.send('Chatbot inmobiliaria listo 🏢'));

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
      ['menu', 'menú', 'hola', 'proyecto'].includes(lower) ||
      state.stage === 'MENU'
    ) {
      state.stage = 'WAIT_OPTION';
      await sendText(from, menuInmo());
      return res.sendStatus(200);
    }

    if (state.stage === 'WAIT_OPTION') {
      if (text === '1') {
        state.stage = 'ASK_PROJECT';
        await sendText(
          from,
          '¿Sobre qué tipo de proyecto te interesa saber?\n\n' +
            'a) Departamentos\nb) Oficinas\nc) Terrenos\n\n' +
            'Responde con *a*, *b* o *c*.'
        );
      } else if (text === '2') {
        await sendDocument(
          from,
          BROCHURE_URL,
          'Brochure general de proyectos inmobiliarios',
          'brochure-proyectos.pdf'
        );
        await sendText(
          from,
          '📄 Te envié el brochure en PDF. Si quieres una propuesta personalizada, escribe *visita*.'
        );
      } else if (text === '3') {
        state.stage = 'ASK_NAME';
        await sendText(
          from,
          'Perfecto 🗓 ¿Cuál es tu nombre completo para la visita?'
        );
      } else if (text === '4') {
        await sendText(
          from,
          '👩‍💼 Un asesor comercial se pondrá en contacto contigo pronto. Si gustas, comparte tu correo o teléfono.'
        );
      } else {
        await sendText(
          from,
          'Opción no válida. Escribe *menu* para ver el menú.'
        );
      }
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_PROJECT') {
      state.proyecto_tipo = text;
      state.stage = 'ASK_BUDGET';
      await sendText(
        from,
        '¿Cuál es tu rango de presupuesto aproximado? (ej: 80,000 - 120,000 USD)'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_BUDGET') {
      state.presupuesto = text;
      state.stage = 'ASK_CONTACT';
      await sendText(
        from,
        'Perfecto. ¿A qué correo o número podemos enviarte información detallada y opciones?'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_CONTACT') {
      const lead = {
        negocio_tipo: 'inmobiliaria',
        wa_from: from,
        nombre: state.nombre || '',
        proyecto_tipo: state.proyecto_tipo || '',
        presupuesto: state.presupuesto || '',
        contacto: text,
        canal: 'whatsapp',
      };

      guardarEnSheets(lead);
      enviarLeadAAPI(lead);

      await sendText(
        from,
        '¡Gracias! Hemos registrado tu interés y un asesor te enviará información detallada del proyecto. 🏢'
      );
      sessions.delete(from);
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_NAME') {
      state.nombre = text;
      state.stage = 'ASK_VISIT_DATETIME';
      await sendText(
        from,
        '¿Para qué día y hora aproximada deseas la visita? (ej: 25/11 a las 4pm)'
      );
      return res.sendStatus(200);
    }

    if (state.stage === 'ASK_VISIT_DATETIME') {
      const leadVisita = {
        negocio_tipo: 'inmobiliaria',
        wa_from: from,
        nombre: state.nombre,
        visita_fecha_hora: text,
        canal: 'whatsapp',
      };

      guardarEnSheets(leadVisita);
      enviarLeadAAPI(leadVisita);

      await sendText(
        from,
        '¡Visita registrada! Nuestro equipo confirmará la cita contigo. 🏢'
      );
      sessions.delete(from);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook inmobiliaria:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏢 Chatbot inmobiliaria escuchando en puerto ${PORT}`);
});
