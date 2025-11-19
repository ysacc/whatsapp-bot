const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

// 🔐 Variables de entorno (Railway)
const TOKEN = process.env.WHATSAPP_TOKEN; // token de Meta
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // 871507329381386
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'ysacc123';

// 🧠 Sesiones simples en memoria (por número)
const sessions = new Map();

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, {
      stage: 'MAIN_MENU',
      nombre: null,
      servicio: null,
      negocio: null,
      presupuesto: null,
      contacto: null,
    });
  }
  return sessions.get(from);
}

function resetSession(from) {
  sessions.delete(from);
}

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
      const text = (message.text && message.text.body) || '';

      console.log(`💬 Mensaje de ${from}: ${text}`);

      const respuesta = await handleBusinessFlow(from, text);
      await enviarMensajeTexto(from, respuesta);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en webhook:', err.message);
    res.sendStatus(500);
  }
});

// 🤖 Lógica de negocio del chatbot
async function handleBusinessFlow(from, rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const session = getSession(from);

  // Comandos globales
  if (['menu', 'menú', '0'].includes(lower)) {
    resetSession(from);
    return mensajeBienvenida();
  }

  if (['salir', 'cancelar'].includes(lower)) {
    resetSession(from);
    return '✅ He cancelado el flujo. Cuando quieras retomar, escribe *hola* o *menu* 🙂';
  }

  // Si es la primera vez que escribe algo tipo "hola"
  if (session.stage === 'MAIN_MENU') {
    if (
      [
        'hola',
        'buenas',
        'buenos días',
        'buenas tardes',
        'buenas noches',
      ].includes(lower)
    ) {
      session.stage = 'ASK_NAME';
      return (
        '👋 ¡Hola! Soy el asistente virtual de *Agencia de Desarrollo – Soluciones Empresariales*.\n\n' +
        'Te ayudamos con:\n' +
        '• Desarrollo web y landing pages\n' +
        '• Sistemas empresariales y SaaS multitenant\n' +
        '• Automatización y marketing digital\n\n' +
        'Para comenzar, ¿cómo te llamas? 🙂'
      );
    } else {
      // Si escribe otra cosa de frente, lo llevamos al inicio
      session.stage = 'ASK_NAME';
      return (
        '👋 ¡Bienvenido a *Agencia de Desarrollo – Soluciones Empresariales*!\n\n' +
        'Antes de ayudarte, dime por favor tu *nombre* 🙂'
      );
    }
  }

  // 1) Nombre
  if (session.stage === 'ASK_NAME') {
    session.nombre = text;
    session.stage = 'ASK_SERVICE';
    return (
      `¡Gracias, *${session.nombre}*! 👌\n\n` +
      'Cuéntame, ¿qué te interesa más?\n\n' +
      '1️⃣ Crear o mejorar una *página web / landing*.\n' +
      '2️⃣ Desarrollar un *sistema a medida* o *SaaS multitenant*.\n' +
      '3️⃣ *Automatizar procesos* y conectar sistemas (APIs, integraciones).\n' +
      '4️⃣ *Marketing digital* y presencia online.\n\n' +
      'Responde con el *número* de la opción o descríbelo con tus palabras.'
    );
  }

  // 2) Servicio
  if (session.stage === 'ASK_SERVICE') {
    let servicioSeleccionado = text;

    if (['1', '2', '3', '4'].includes(text)) {
      const mapaServicios = {
        1: 'Página web / landing enfocada en ventas y presencia profesional.',
        2: 'Sistema a medida o SaaS multitenant para gestionar procesos de tu empresa.',
        3: 'Automatización de procesos e integraciones entre tus sistemas (APIs, bots, etc.).',
        4: 'Estrategia de marketing digital y presencia online para atraer más clientes.',
      };
      servicioSeleccionado = mapaServicios[text];
    }

    session.servicio = servicioSeleccionado;
    session.stage = 'ASK_BUSINESS';

    return (
      `Perfecto, trabajamos mucho en ese tipo de proyectos 💼\n\n` +
      `📌 Interés: *${session.servicio}*\n\n` +
      'Ahora, cuéntame un poco de tu negocio:\n' +
      '¿En qué rubro estás y en qué país trabajas principalmente?'
    );
  }

  // 3) Info del negocio
  if (session.stage === 'ASK_BUSINESS') {
    session.negocio = text;
    session.stage = 'ASK_BUDGET';

    return (
      'Genial, gracias por el contexto 🙌\n\n' +
      'Para proponerte algo realista, ¿en qué rango aproximado está tu *presupuesto* para este proyecto?\n\n' +
      'Por ejemplo:\n' +
      '• *Bajo:* quiero algo inicial, mínimo viable\n' +
      '• *Medio:* busco algo sólido y escalable\n' +
      '• *Alto:* quiero una solución completa, lista para crecer\n\n' +
      'Puedes responder con el rango o con un monto aproximado.'
    );
  }

  // 4) Presupuesto
  if (session.stage === 'ASK_BUDGET') {
    session.presupuesto = text;
    session.stage = 'ASK_CONTACT';

    return (
      'Perfecto, con eso ya puedo dimensionar el tipo de solución 💡\n\n' +
      'Por último, ¿a qué *correo* o *WhatsApp* podemos enviarte una propuesta / agendar una reunión breve?\n\n' +
      'Ejemplo: *correo@empresa.com* o *+51 999 999 999*'
    );
  }

  // 5) Contacto
  if (session.stage === 'ASK_CONTACT') {
    session.contacto = text;
    session.stage = 'DONE';

    const resumen =
      `🧾 *Resumen de tu solicitud:*\n\n` +
      `• Nombre: *${session.nombre}*\n` +
      `• Interés: *${session.servicio}*\n` +
      `• Negocio: *${session.negocio}*\n` +
      `• Presupuesto: *${session.presupuesto}*\n` +
      `• Contacto: *${session.contacto}*\n\n`;

    // aquí podrías: guardar en BD, enviar email, etc.
    // por ahora solo cerramos la venta suave
    resetSession(from);

    return (
      resumen +
      '✅ ¡Listo! Con esa info podemos prepararte una propuesta a medida.\n\n' +
      'Un especialista de *Agencia de Desarrollo – Soluciones Empresariales* te contactará en las próximas horas para comentarte opciones claras y tiempos.\n\n' +
      'Si quieres seguir hablando por aquí, en cualquier momento puedes escribir *menu* para ver de nuevo las opciones. 😊'
    );
  }

  // Fallback genérico
  return (
    'No estoy seguro de haber entendido 🧐\n' +
    'Escribe *menu* para empezar de nuevo o *salir* para terminar la conversación.'
  );
}

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
console.log('🔑 Longitud TOKEN:', TOKEN ? TOKEN.length : 'TOKEN vacío');
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
