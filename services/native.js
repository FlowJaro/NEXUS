// ---------------------------------------------------------------------------
// NEXUS · Carga segura de modulos nativos
//
// Los modulos que no existen en la web (o que pueden no estar en Expo Go) se
// cargan con require() dentro de try/catch. Asi la app no se cae al abrirla en
// el navegador ni cuando falta un modulo nativo.
// ---------------------------------------------------------------------------

import { Platform } from 'react-native';

const cache = {};

function cargar(clave, disponible, importar) {
  if (!disponible) return null;
  if (Object.prototype.hasOwnProperty.call(cache, clave)) return cache[clave];

  let modulo = null;
  try {
    modulo = importar();
  } catch (error) {
    console.warn(`NEXUS: modulo nativo no disponible (${clave}).`, error?.message);
    modulo = null;
  }

  cache[clave] = modulo;
  return modulo;
}

export function modContacts() {
  return cargar('expo-contacts', Platform.OS !== 'web', () => {
    try {
      return require('expo-contacts/legacy');
    } catch (e) {
      return require('expo-contacts');
    }
  });
}

export function modMediaLibrary() {
  return cargar('expo-media-library', Platform.OS !== 'web', () =>
    require('expo-media-library')
  );
}

export function modIntentLauncher() {
  return cargar('expo-intent-launcher', Platform.OS === 'android', () =>
    require('expo-intent-launcher')
  );
}

export function modImagePicker() {
  return cargar('expo-image-picker', Platform.OS !== 'web', () =>
    require('expo-image-picker')
  );
}

export function modLocation() {
  return cargar('expo-location', Platform.OS !== 'web', () => require('expo-location'));
}

export function modBrightness() {
  return cargar('expo-brightness', Platform.OS !== 'web', () =>
    require('expo-brightness')
  );
}

export function modAudio() {
  return cargar('expo-audio', Platform.OS !== 'web', () => require('expo-audio'));
}

export function esMovil() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
