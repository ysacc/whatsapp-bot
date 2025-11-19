// genericFlow.js
// Flujo genérico de chatbot para negocios:
// - Menú principal
// - Ver catálogo (link)
// - Descargar PDF (brochure)
// - Ver ubicación (Google Maps)
// - Hablar con un asesor
//
// Este módulo NO conoce de WhatsApp Cloud directamente:
// solo usa helpers que le pasas desde index.js.

function createGenericFlow({ sendText, sendDocument, sendLocation }) {
  const sessions = new Map();

  function getSession(from) {
    if (!sessions.has(from)) {
      sessions.set(from, {
        stage: 'MAIN_MENU',
      });
    }
    return sessions.get(from);
  }

  function resetSession(from) {
    sessions.delete(from);
  }

  async function handleMessage(from, rawText) {
    const text = (rawText || '').trim();
    const lower = text.toLowerCase();
    const session = getSession(from);

    // Comandos globales
    if (['menu', 'menú', '0'].includes(lower)) {
      session.stage = 'MAIN_MENU';
      return menuPrincipal();
    }

    if (['salir', 'cancelar'].includes(lower)) {
      resetSession(from);
      return '✅ Hemos cerrado la conversación. Cuando quieras retomar, escribe *hola* o *menu* 🙂';
    }

    // Primera interacción
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
        return menuPrincipal();
      }
      // Si escribe otra cosa, le mostramos el menú igual
      return menuPrincipal();
    }

    if (session.stage === 'AWAIT_OPTION') {
      if (lower === '1') {
        // Ver catálogo (link)
        await sendText(
          from,
          '📦 Aquí puedes ver nuestro catálogo completo: https://tu-dominio.com/catalogo'
        );
        return '¿Quieres ver algo más? Escribe *menu* para volver al inicio.';
      } else if (lower === '2') {
        // Enviar PDF (brochure)
        await sendDocument(
          from,
          'https://tu-dominio.com/brochure.pdf',
          'Brochure de servicios',
          'brochure-servicios.pdf'
        );
        return '📄 Te he enviado nuestro brochure en PDF. ¿Te ayudo con algo más? Escribe *menu* para volver.';
      } else if (lower === '3') {
        // Enviar ubicación
        await sendLocation(
          from,
          -12.046374, // lat de ejemplo (Lima)
          -77.042793, // lng de ejemplo
          'Nuestra oficina principal',
          'Estamos aquí. Puedes visitarnos con previa cita.'
        );
        return '📍 Te he compartido nuestra ubicación. Si necesitas ayuda adicional, escribe *menu*.';
      } else if (lower === '4') {
        // Hablar con asesor
        return (
          '👨‍💼 Te voy a derivar con un asesor humano.\n' +
          'Por favor, dime brevemente qué necesitas y un número/correo de contacto.\n\n' +
          'También puedes escribir *salir* para cerrar.'
        );
      }

      return 'No reconocí esa opción 🧐. Escribe *menu* para ver el menú de nuevo.';
    }

    // Si no calza en nada, devolvemos menú
    return menuPrincipal();
  }

  function menuPrincipal() {
    return (
      '👋 ¡Hola! Soy el asistente virtual.\n\n' +
      '¿Qué te gustaría hacer hoy?\n\n' +
      '1️⃣ Ver catálogo de productos/servicios\n' +
      '2️⃣ Descargar brochure en PDF\n' +
      '3️⃣ Ver ubicación de la tienda/oficina\n' +
      '4️⃣ Hablar con un asesor\n\n' +
      'Responde con el *número* de la opción.\n' +
      'En cualquier momento puedes escribir *menu* para volver aquí.'
    );
  }

  return {
    handleMessage,
  };
}

module.exports = {
  createGenericFlow,
};
