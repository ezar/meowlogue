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

  'nav.home': 'Inicio',
  'nav.household': 'Tu casa',
  'nav.help': 'Ayuda',
  'nav.back': 'Volver',

  'nav.listen': 'Escuchar',
  'nav.debug': 'Depuración',

  'listen.title': 'Escuchar',
  'listen.idle': 'En silencio. Pulsa para empezar a escuchar.',
  'listen.loading': 'Cargando los modelos…',
  'listen.listening': 'Escuchando',
  'listen.start': 'Empezar a escuchar',
  'listen.stop': 'Parar',
  'listen.screenOpen':
    'Deja esta pantalla abierta: el micrófono se para cuando el teléfono se bloquea.',
  'listen.learning':
    'Todavía estoy aprendiendo las voces. Confirma quién ha sido y, con {needed} ejemplos por gato, empezaré a proponerlo yo.',
  'listen.learningOneCat':
    'Con un solo gato no hay a quién distinguir, así que no pregunto quién ha sido.',
  'listen.empty': 'Todavía no he oído nada.',
  'listen.emptyHint': 'Buenos momentos: antes de comer, en la puerta, cuando llegas a casa.',
  'listen.recent': 'Lo último',

  'event.who': '¿Quién ha sido?',
  'event.what': '¿De qué iba?',
  'event.notACat': 'No era un gato',
  'event.wasNotACat': 'Marcado como «no era un gato»',
  'event.possibleHuman': 'Puede que fuera una persona imitando',
  'event.unconfirmed': 'Sin confirmar',
  'event.delete': 'Borrar',
  'event.syllables': '{count} sílabas',
  'event.syllablesOne': '1 sílaba',

  'type.meow': 'maullido',
  'type.purr': 'ronroneo',
  'type.hiss': 'bufido',
  'type.yowl': 'aullido',
  'type.chirp': 'trino',
  'type.growl': 'gruñido',

  'household.title': 'Tu casa',
  'household.subtitle':
    'Añade, quita o renombra gatos cuando cambie la casa. Los cambios se guardan al momento.',
  'household.addTitle': 'Añadir otro gato',
  'household.edit': 'Editar',
  'household.save': 'Guardar',
  'household.cancel': 'Cancelar',
  'household.identityOn': 'Con {count} gatos, Meowlogue puede aprender a distinguir quién llama.',
  'household.identityOff':
    'Con un solo gato la identificación por voz se queda desactivada, y el modelo que la entrena ni se descarga.',
  'household.removeConfirm': '¿Quitar a {name}? Se van también sus etiquetas.',
  'household.removeYes': 'Sí, quitar',
  'household.dangerTitle': 'Empezar de cero',
  'household.dangerBody':
    'Borra los gatos, sus etiquetas y lo aprendido, y vuelve a la pantalla de bienvenida. No se puede deshacer.',
  'household.dangerCta': 'Borrar y empezar de cero',
  'household.dangerConfirm': 'Sí, bórralo todo',
  'household.dangerKeep': 'Mejor no',

  'help.title': 'Cómo funciona',
  'help.honestyTitle': 'Lo que no hace',
  'help.honesty':
    'Meowlogue no traduce a tus gatos. Aprende los hábitos de tu casa: quién llama, cuándo y en qué situación, y te lo enseña con la confianza que tiene en cada suposición.',
  'help.confidenceTitle': 'Cuando dice «no estoy seguro»',
  'help.confidence':
    'Cada suposición lleva su confianza. Por debajo del 55% no te da un nombre: te pide que confirmes. Y hasta que no tenga 10 ejemplos de cada gato y acierte el 80% en su propia prueba, no enseña identificaciones en absoluto.',
  'help.privacyTitle': 'Dónde está el audio',
  'help.modelsTitle': 'Los modelos',
  'help.models':
    'La primera escucha descarga unos 23 MB de modelos y los guarda para las siguientes. Con un solo gato se ahorra 13 MB: el modelo de identidad no hace falta si no hay a quién distinguir.',

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
