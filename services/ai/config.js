// ---------------------------------------------------------------------------
// NEXUS · Configuracion de proveedores de IA gratuitos
//
// Todos los proveedores hablan el mismo protocolo (OpenAI compatible), asi que
// un solo cliente sirve para todos. El orden de "auto" esta pensado para gastar
// cero dinero y para que la app SIEMPRE pueda responder sin pedirle claves al
// usuario:
//
//   Gemini/Groq/OpenRouter  -> solo si hay claves cargadas en segundo plano
//   LLM7                    -> gratis y sin clave (token publico "unused")
//   Pollinations            -> gratis y sin clave (con limite de velocidad)
//   Local                   -> responde sin internet
//
// El usuario final nunca ve ni escribe una clave.
// ---------------------------------------------------------------------------

export const PROVEEDORES = {
  auto: {
    id: 'auto',
    nombre: 'Automatico',
    descripcion:
      'Elige solo el mejor proveedor disponible en cada momento. No tienes que configurar nada.',
    requiereClave: false,
    url: null,
    modelos: [],
    modeloPorDefecto: null,
    enlaceClave: null,
  },

  gemini: {
    id: 'gemini',
    nombre: 'Google Gemini',
    descripcion:
      'La mejor calidad e inteligencia. Funciona con la clave integrada de Gemini.',
    requiereClave: true,
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelos: [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
    ],
    modeloPorDefecto: 'gemini-3.8-flash',
    enlaceClave: 'https://aistudio.google.com/apikey',
  },

  puter: {
    id: 'puter',
    nombre: 'OpenAI (vía Puter)',
    descripcion:
      'Acceso gratuito e ilimitado a modelos OpenAI (GPT-4o, GPT-4o-mini) mediante la API de Puter.',
    requiereClave: false,
    claveFija: 'puter-free',
    url: 'https://api.puter.com/puterai/openai/v1/chat/completions',
    modelos: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4.1-mini',
      'gpt-3.5-turbo',
    ],
    modeloPorDefecto: 'gpt-4o-mini',
    enlaceClave: 'https://developer.puter.com/tutorials/free-unlimited-ai-api/',
  },

  groq: {
    id: 'groq',
    nombre: 'Groq',
    descripcion:
      'Muy rapido. Se activa solo cuando NEXUS consigue una clave automaticamente.',
    requiereClave: true,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelos: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-20b',
    ],
    modeloPorDefecto: 'llama-3.3-70b-versatile',
    enlaceClave: 'https://console.groq.com/keys',
  },

  openrouter: {
    id: 'openrouter',
    nombre: 'OpenRouter (:free)',
    descripcion:
      'Enrutador de modelos gratuitos. Se activa solo cuando NEXUS consigue una clave automaticamente.',
    requiereClave: true,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modelos: ['openrouter/free'],
    modeloPorDefecto: 'openrouter/free',
    enlaceClave: 'https://openrouter.ai/keys',
  },

  llm7: {
    id: 'llm7',
    nombre: 'LLM7 (sin clave)',
    descripcion:
      'Gratis, sin registro y muy rapido. Es el proveedor principal de NEXUS.',
    requiereClave: false,
    // Token publico que el servicio acepta para el nivel gratuito.
    claveFija: 'unused',
    url: 'https://api.llm7.io/v1/chat/completions',
    modelos: ['gpt-oss:20b', 'default'],
    modeloPorDefecto: 'gpt-oss:20b',
    enlaceClave: null,
  },

  pollinations: {
    id: 'pollinations',
    nombre: 'Pollinations (sin clave)',
    descripcion:
      'Funciona sin registrarte ni pagar. Se usa como respaldo cuando LLM7 esta ocupado.',
    requiereClave: false,
    url: 'https://text.pollinations.ai/openai',
    modelos: ['openai'],
    modeloPorDefecto: 'openai',
    enlaceClave: null,
  },

  local: {
    id: 'local',
    nombre: 'Local (sin internet)',
    descripcion:
      'Responde sin conexion: recordatorios, alarmas, hora, fecha, cuentas y comandos basicos.',
    requiereClave: false,
    url: null,
    modelos: [],
    modeloPorDefecto: null,
    enlaceClave: null,
  },
};

// Orden de intentos cuando el usuario elige "Automatico".
// Primero los que dan mejor calidad (Gemini con clave, Puter con OpenAI),
// despues los que nunca fallan por falta de clave.
export const ORDEN_AUTO = ['gemini', 'puter', 'llm7', 'pollinations', 'groq', 'openrouter'];

export const PROVEEDORES_CON_IA = ORDEN_AUTO.slice();

// Proveedores que funcionan sin que nadie configure nada.
export const PROVEEDORES_SIN_CLAVE = ['puter', 'llm7', 'pollinations'];

export const MAX_ACCIONES = 4;
export const MAX_HISTORIAL = 12;

export function etiquetaProveedor(id) {
  return PROVEEDORES[id]?.nombre || id || 'IA';
}
