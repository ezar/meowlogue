/**
 * Spanish dictionary. The default language (spec section 7).
 *
 * This is the reference dictionary: `en.ts` is typed against it, so a key
 * added here and forgotten there is a compile error.
 */
export const es = {
  'app.name': 'Meowlogue',

  'onboarding.welcome.title': 'Tus gatos tienen vocabulario',
  'onboarding.welcome.body':
    'Meowlogue escucha, aprende a distinguir a tus gatos por la voz y va anotando cuándo y cuánto hablan. No traduce: aprende los hábitos de tu casa.',
  'onboarding.welcome.cta': 'Empezar',

  'onboarding.privacy.title': 'El audio se queda aquí',
  'onboarding.privacy.mic':
    'Escucha por el micrófono solo cuando tú lo enciendes, y la pantalla tiene que estar abierta.',
  'onboarding.privacy.local':
    'Todo el análisis ocurre en este dispositivo. No hay servidor, ni cuenta, ni analítica.',
  'onboarding.privacy.clips':
    'Los clips se guardan en el teléfono y se borran según la retención que elijas. Solo salen de aquí si tú compartes uno.',
  'onboarding.privacy.models':
    'Lo único que se descarga son los modelos de reconocimiento, una vez.',
  'onboarding.privacy.cta': 'Lo entiendo',
  'onboarding.privacy.back': 'Atrás',

  'onboarding.cats.title': 'Añade a tus gatos',
  'onboarding.cats.subtitle':
    'Con dos o más, Meowlogue aprende a distinguir quién llama. Con uno, esa parte se queda apagada.',
  'onboarding.cats.nameLabel': 'Nombre',
  'onboarding.cats.namePlaceholder': 'Luna',
  'onboarding.cats.colorLabel': 'Color',
  'onboarding.cats.colorTaken': 'ya en uso',
  'onboarding.cats.photoLabel': 'Foto (opcional)',
  'onboarding.cats.photoAdd': 'Elegir foto',
  'onboarding.cats.photoRemove': 'Quitar foto',
  'onboarding.cats.add': 'Añadir gato',
  'onboarding.cats.remove': 'Quitar',
  'onboarding.cats.empty': 'Todavía no hay ningún gato.',
  'onboarding.cats.finish': 'Listo',
  'onboarding.cats.oneCatNote':
    'Con un solo gato no hay a quién confundir, así que la identificación por voz se queda desactivada. Puedes añadir otro cuando quieras.',
  'onboarding.cats.count': 'gatos en casa',
  'onboarding.cats.countOne': 'gato en casa',

  'onboarding.error.empty': 'Ponle un nombre.',
  'onboarding.error.tooLong': 'Demasiado largo: máximo 24 caracteres.',
  'onboarding.error.duplicate': 'Ya tienes un gato con ese nombre.',
  'onboarding.error.photo': 'No se pudo leer esa imagen.',

  'onboarding.step': 'Paso {current} de {total}',

  'color.honey': 'miel',
  'color.rust': 'teja',
  'color.plum': 'ciruela',
  'color.indigo': 'índigo',
  'color.teal': 'turquesa',
  'color.moss': 'musgo',
  'color.slate': 'pizarra',
  'color.cocoa': 'cacao',

  'label.food': 'comida',
  'label.door': 'puerta',
  'label.attention': 'atención',
  'label.greeting': 'saludo',
  'label.play': 'juego',
  'label.complaint': 'queja',
  'label.night': 'llamada nocturna',
  'label.litter': 'arenero',
  'label.other': 'otro',
} as const;

/** Every key the app can translate. */
export type MessageKey = keyof typeof es;
