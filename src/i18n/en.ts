import type { MessageKey } from './es';

/**
 * English dictionary, second language (spec section 7).
 *
 * Typed as a complete record of {@link MessageKey}, so adding a key to the
 * Spanish dictionary without adding it here fails the build rather than
 * silently falling back.
 */
export const en: Record<MessageKey, string> = {
  'app.name': 'Meowlogue',

  'onboarding.welcome.title': 'Your cats have a vocabulary',
  'onboarding.welcome.body':
    'Meowlogue listens, learns to tell your cats apart by voice, and keeps a record of when and how much they talk. It does not translate: it learns your household.',
  'onboarding.welcome.cta': 'Get started',

  'onboarding.privacy.title': 'The audio stays here',
  'onboarding.privacy.mic':
    'It listens through the microphone only when you switch it on, and only while the screen is open.',
  'onboarding.privacy.local':
    'All the analysis happens on this device. No server, no account, no analytics.',
  'onboarding.privacy.clips':
    'Clips are kept on the phone and deleted according to the retention you choose. They leave only if you share one.',
  'onboarding.privacy.models': 'The only download is the recognition models, once.',
  'onboarding.privacy.cta': 'Got it',
  'onboarding.privacy.back': 'Back',

  'onboarding.cats.title': 'Add your cats',
  'onboarding.cats.subtitle':
    'With two or more, Meowlogue learns who is calling. With one, that part stays off.',
  'onboarding.cats.nameLabel': 'Name',
  'onboarding.cats.namePlaceholder': 'Luna',
  'onboarding.cats.colorLabel': 'Colour',
  'onboarding.cats.colorTaken': 'already used',
  'onboarding.cats.photoLabel': 'Photo (optional)',
  'onboarding.cats.photoAdd': 'Choose photo',
  'onboarding.cats.photoRemove': 'Remove photo',
  'onboarding.cats.add': 'Add cat',
  'onboarding.cats.remove': 'Remove',
  'onboarding.cats.empty': 'No cats yet.',
  'onboarding.cats.finish': 'Done',
  'onboarding.cats.oneCatNote':
    'With a single cat there is nobody to confuse them with, so voice identification stays off. You can add another whenever you like.',
  'onboarding.cats.count': 'cats at home',
  'onboarding.cats.countOne': 'cat at home',

  'onboarding.error.empty': 'Give them a name.',
  'onboarding.error.tooLong': 'Too long: 24 characters at most.',
  'onboarding.error.duplicate': 'You already have a cat with that name.',
  'onboarding.error.photo': 'That image could not be read.',

  'onboarding.step': 'Step {current} of {total}',

  'color.honey': 'honey',
  'color.rust': 'rust',
  'color.plum': 'plum',
  'color.indigo': 'indigo',
  'color.teal': 'teal',
  'color.moss': 'moss',
  'color.slate': 'slate',
  'color.cocoa': 'cocoa',

  'nav.home': 'Home',
  'nav.household': 'Your household',
  'nav.help': 'Help',
  'nav.back': 'Back',

  'household.title': 'Your household',
  'household.subtitle':
    'Add, remove or rename cats when the household changes. Changes are saved as you make them.',
  'household.addTitle': 'Add another cat',
  'household.edit': 'Edit',
  'household.save': 'Save',
  'household.cancel': 'Cancel',
  'household.identityOn': 'With {count} cats, Meowlogue can learn who is calling.',
  'household.identityOff':
    'With a single cat, voice identity stays off and the model that trains it is not even downloaded.',
  'household.removeConfirm': 'Remove {name}? Its labels go too.',
  'household.removeYes': 'Yes, remove',
  'household.dangerTitle': 'Start over',
  'household.dangerBody':
    'Deletes the cats, their labels and everything learned, and returns to the welcome screen. This cannot be undone.',
  'household.dangerCta': 'Delete everything and start over',
  'household.dangerConfirm': 'Yes, delete it all',
  'household.dangerKeep': 'Keep it',

  'help.title': 'How it works',
  'help.honestyTitle': 'What it does not do',
  'help.honesty':
    'Meowlogue does not translate your cats. It learns your household\u2019s habits — who calls, when, and in what situation — and shows you how confident it is about each guess.',
  'help.confidenceTitle': 'When it says \u201cnot sure\u201d',
  'help.confidence':
    'Every guess carries its confidence. Below 55% it gives you no name at all and asks you to confirm. And until it has 10 examples per cat and scores 80% on its own self-test, it shows no identity guesses whatsoever.',
  'help.privacyTitle': 'Where the audio is',
  'help.modelsTitle': 'The models',
  'help.models':
    'The first listening session downloads about 23 MB of models and keeps them for later ones. With a single cat it saves 13 MB: the identity model is pointless with nobody to tell apart.',

  'label.food': 'food',
  'label.door': 'door',
  'label.attention': 'attention',
  'label.greeting': 'greeting',
  'label.play': 'play',
  'label.complaint': 'complaint',
  'label.night': 'night calling',
  'label.litter': 'litter',
  'label.other': 'other',
};
