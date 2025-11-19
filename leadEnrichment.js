// leadEnrichment.js
// Toda la lógica de enriquecimiento de leads va aquí.
// Así lo puedes reutilizar en otros flujos o proyectos.

function detectarIdioma(texto) {
  const t = (texto || '').toLowerCase();

  // Heurística sencilla para ES / EN (ampliable a DE/FR luego)
  if (/[ñáéíóúü]/.test(t) || /\bque\b|\bpara\b|\bpero\b|\bporque\b/.test(t)) {
    return 'es';
  }
  if (/\bthe\b|\band\b|\bfor\b|\bwith\b|\bproject\b/.test(t)) {
    return 'en';
  }

  return 'desconocido';
}

function detectarPaisDesdeNumero(from) {
  if (!from) return 'desconocido';
  // Ejemplo simple: +51 / 51 => Perú
  if (from.startsWith('51') || from.startsWith('+51')) return 'Perú';
  if (from.startsWith('34') || from.startsWith('+34')) return 'España';
  if (from.startsWith('49') || from.startsWith('+49')) return 'Alemania';
  // Puedes ir sumando más prefijos según tus clientes
  return 'desconocido';
}

function clasificarServicio(servicio) {
  const t = (servicio || '').toLowerCase();
  if (t.includes('landing') || t.includes('página web') || t.includes('web')) {
    return 'web';
  }
  if (
    t.includes('saas') ||
    t.includes('sistema') ||
    t.includes('erp') ||
    t.includes('multitenant')
  ) {
    return 'saas/sistema';
  }
  if (
    t.includes('automatización') ||
    t.includes('integracion') ||
    t.includes('api')
  ) {
    return 'automatizacion';
  }
  if (t.includes('marketing') || t.includes('ads') || t.includes('redes')) {
    return 'marketing';
  }
  return 'otro';
}

function calcularNivelInteres(presupuestoTexto) {
  const t = (presupuestoTexto || '').toLowerCase();

  // Intentar extraer número
  const numeros = t.match(/\d+/g);
  let monto = null;
  if (numeros && numeros.length > 0) {
    monto = parseInt(numeros.join(''), 10);
  }

  let nivel = 'Desconocido';
  let score = 50;
  let ticket = 'medio';

  if (monto !== null && !isNaN(monto)) {
    if (monto < 500) {
      nivel = 'Bajo';
      score = 40;
      ticket = 'bajo';
    } else if (monto < 2000) {
      nivel = 'Medio';
      score = 70;
      ticket = 'medio';
    } else {
      nivel = 'Alto';
      score = 90;
      ticket = 'alto';
    }
  } else {
    if (
      t.includes('bajo') ||
      t.includes('limitado') ||
      t.includes('ajustado')
    ) {
      nivel = 'Bajo';
      score = 40;
      ticket = 'bajo';
    } else if (t.includes('medio')) {
      nivel = 'Medio';
      score = 70;
      ticket = 'medio';
    } else if (
      t.includes('alto') ||
      t.includes('completo') ||
      t.includes('robusto')
    ) {
      nivel = 'Alto';
      score = 90;
      ticket = 'alto';
    }
  }

  return { nivelInteres: nivel, score, ticket };
}

function detectarTipoCliente(negocio) {
  const t = (negocio || '').toLowerCase();
  if (
    t.includes('empresa') ||
    t.includes('negocio') ||
    t.includes('tienda') ||
    t.includes('clínica') ||
    t.includes('consultorio')
  ) {
    return 'b2b';
  }
  if (
    t.includes('freelance') ||
    t.includes('independiente') ||
    t.includes('personal')
  ) {
    return 'freelance';
  }
  return 'desconocido';
}

// Enriquecimiento completo
function enrichLead(baseLead) {
  const { from, nombre, servicio, negocio, presupuesto, contacto } = baseLead;

  const textoGlobal = `${nombre || ''} ${servicio || ''} ${negocio || ''} ${
    presupuesto || ''
  } ${contacto || ''}`;

  const idioma = detectarIdioma(textoGlobal);
  const pais = detectarPaisDesdeNumero(from);
  const categoriaServicio = clasificarServicio(servicio);
  const { nivelInteres, score, ticket } = calcularNivelInteres(presupuesto);
  const tipoCliente = detectarTipoCliente(negocio);

  return {
    ...baseLead,
    idioma,
    pais,
    categoria_servicio: categoriaServicio,
    nivel_interes: nivelInteres,
    score_num: score,
    ticket_estimado: ticket,
    tipo_cliente: tipoCliente,
    canal: 'whatsapp',
    fuente: 'bot_agencia_desarrollo',
  };
}

module.exports = {
  enrichLead,
};
