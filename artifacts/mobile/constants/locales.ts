/**
 * The language registry is deliberately data-only. Adding a language means
 * adding one entry here and (optionally) its copy below; screens do not need
 * to know about individual language codes.
 */
export const LANGUAGE_REGISTRY = [
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish", turkishName: "Türkçe" },
  { code: "en", nativeName: "English", englishName: "English", turkishName: "İngilizce" },
  { code: "de", nativeName: "Deutsch", englishName: "German", turkishName: "Almanca" },
  { code: "fr", nativeName: "Français", englishName: "French", turkishName: "Fransızca" },
  { code: "es", nativeName: "Español", englishName: "Spanish", turkishName: "İspanyolca" },
  { code: "it", nativeName: "Italiano", englishName: "Italian", turkishName: "İtalyanca" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", turkishName: "Portekizce" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", turkishName: "Rusça" },
  { code: "uk", nativeName: "Українська", englishName: "Ukrainian", turkishName: "Ukraynaca" },
  { code: "pl", nativeName: "Polski", englishName: "Polish", turkishName: "Lehçe" },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch", turkishName: "Felemenkçe" },
  { code: "sv", nativeName: "Svenska", englishName: "Swedish", turkishName: "İsveççe" },
  { code: "no", nativeName: "Norsk", englishName: "Norwegian", turkishName: "Norveççe" },
  { code: "da", nativeName: "Dansk", englishName: "Danish", turkishName: "Danca" },
  { code: "fi", nativeName: "Suomi", englishName: "Finnish", turkishName: "Fince" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek", turkishName: "Yunanca" },
  { code: "cs", nativeName: "Čeština", englishName: "Czech", turkishName: "Çekçe" },
  { code: "sk", nativeName: "Slovenčina", englishName: "Slovak", turkishName: "Slovakça" },
  { code: "hu", nativeName: "Magyar", englishName: "Hungarian", turkishName: "Macarca" },
  { code: "ro", nativeName: "Română", englishName: "Romanian", turkishName: "Romence" },
  { code: "bg", nativeName: "Български", englishName: "Bulgarian", turkishName: "Bulgarca" },
  { code: "sr", nativeName: "Српски", englishName: "Serbian", turkishName: "Sırpça" },
  { code: "hr", nativeName: "Hrvatski", englishName: "Croatian", turkishName: "Hırvatça" },
  { code: "sl", nativeName: "Slovenščina", englishName: "Slovenian", turkishName: "Slovence" },
  { code: "lt", nativeName: "Lietuvių", englishName: "Lithuanian", turkishName: "Litvanca" },
  { code: "lv", nativeName: "Latviešu", englishName: "Latvian", turkishName: "Letonca" },
  { code: "et", nativeName: "Eesti", englishName: "Estonian", turkishName: "Estonca" },
  { code: "bs", nativeName: "Bosanski", englishName: "Bosnian", turkishName: "Boşnakça" },
  { code: "sq", nativeName: "Shqip", englishName: "Albanian", turkishName: "Arnavutça" },
  { code: "mk", nativeName: "Македонски", englishName: "Macedonian", turkishName: "Makedonca" },
  { code: "he", nativeName: "עברית", englishName: "Hebrew", turkishName: "İbranice" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", turkishName: "Arapça" },
  { code: "fa", nativeName: "فارسی", englishName: "Persian", turkishName: "Farsça" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", turkishName: "Hintçe" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali", turkishName: "Bengalce" },
  { code: "ur", nativeName: "اردو", englishName: "Urdu", turkishName: "Urduca" },
  { code: "zh", nativeName: "中文", englishName: "Chinese", turkishName: "Çince" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", turkishName: "Japonca" },
  { code: "ko", nativeName: "한국어", englishName: "Korean", turkishName: "Korece" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese", turkishName: "Vietnamca" },
  { code: "th", nativeName: "ไทย", englishName: "Thai", turkishName: "Tayca" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", turkishName: "Endonezce" },
  { code: "ms", nativeName: "Bahasa Melayu", englishName: "Malay", turkishName: "Malayca" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino", turkishName: "Filipince" },
] as const;

export type Lang = (typeof LANGUAGE_REGISTRY)[number]["code"];

type Copy = {
  core: string[];
  common: string[];
  language: string[];
  navigation: string[];
  settings: string[];
  profile: string[];
  chat: string[];
};

export type LocaleTree = Record<string, Record<string, string>>;

/** Shared shape keeps every locale small while retaining a predictable API. */
function defineCore(copy: Copy): LocaleTree {
  return {
    core: { appName: copy.core[0], welcome: copy.core[1] },
    common: {
      cancel: copy.common[0], ok: copy.common[1], retry: copy.common[2],
      close: copy.common[3], back: copy.navigation[4],
    },
    language: { title: copy.language[0], subtitle: copy.language[1], note: copy.language[2] },
    navigation: {
      home: copy.navigation[0], chat: copy.navigation[1], settings: copy.navigation[2],
      profile: copy.navigation[3], back: copy.navigation[4],
    },
    settings: {
      title: copy.navigation[2],
      appearance: copy.settings[0], notifications: copy.settings[1],
      privacy: copy.settings[2], privacyItem: copy.settings[2],
      dataPrivacy: copy.settings[2],
      profile: copy.navigation[3], language: copy.language[0],
      appLanguage: copy.language[0], logout: copy.settings[3],
    },
    profile: {
      name: copy.profile[0], email: copy.profile[1],
      freePlan: copy.profile[2], upgrade: copy.profile[3],
    },
    chat: {
      placeholder: copy.chat[0], listening: copy.chat[1],
      newChat: copy.chat[2], send: copy.chat[3],
    },
    sidebar: {
      newChat: copy.chat[2],
      settings: copy.navigation[2],
    },
  };
}

/**
 * Core copy for the additional languages. The comprehensive Turkish and
 * English dictionaries remain the source of truth for less common keys.
 */
export const CORE_LOCALES: Partial<Record<Lang, LocaleTree>> = {
  de: defineCore({ core: ["Intelligenz in deiner Tasche", "Willkommen"], common: ["Abbrechen", "OK", "Erneut versuchen", "Schließen"], language: ["App-Sprache", "Wähle deine bevorzugte Sprache", "Die Änderung wird sofort auf allen Bildschirmen angewendet."], navigation: ["Startseite", "Chat", "Einstellungen", "Profil", "Zurück"], settings: ["Darstellung", "Benachrichtigungen", "Datenschutz", "Abmelden"], profile: ["Name", "E-Mail", "Kostenloser Plan", "Auf Premium upgraden"], chat: ["An AkılCEP schreiben…", "Ich höre zu…", "Neuer Chat", "Senden"] }),
  fr: defineCore({ core: ["L’intelligence dans votre poche", "Bienvenue"], common: ["Annuler", "OK", "Réessayer", "Fermer"], language: ["Langue de l’application", "Choisissez votre langue préférée", "Le changement s’applique instantanément à tous les écrans."], navigation: ["Accueil", "Chat", "Réglages", "Profil", "Retour"], settings: ["Apparence", "Notifications", "Confidentialité", "Se déconnecter"], profile: ["Nom", "E-mail", "Forfait gratuit", "Passer à Premium"], chat: ["Écrire à AkılCEP…", "Je vous écoute…", "Nouveau chat", "Envoyer"] }),
  es: defineCore({ core: ["Inteligencia en tu bolsillo", "Bienvenido"], common: ["Cancelar", "Aceptar", "Reintentar", "Cerrar"], language: ["Idioma de la aplicación", "Elige tu idioma preferido", "El cambio se aplica al instante en todas las pantallas."], navigation: ["Inicio", "Chat", "Ajustes", "Perfil", "Atrás"], settings: ["Apariencia", "Notificaciones", "Privacidad", "Cerrar sesión"], profile: ["Nombre", "Correo electrónico", "Plan gratuito", "Pasar a Premium"], chat: ["Escribe a AkılCEP…", "Te escucho…", "Nuevo chat", "Enviar"] }),
  it: defineCore({ core: ["Intelligenza in tasca", "Benvenuto"], common: ["Annulla", "OK", "Riprova", "Chiudi"], language: ["Lingua dell’app", "Scegli la tua lingua preferita", "La modifica si applica subito a tutte le schermate."], navigation: ["Home", "Chat", "Impostazioni", "Profilo", "Indietro"], settings: ["Aspetto", "Notifiche", "Privacy", "Esci"], profile: ["Nome", "E-mail", "Piano gratuito", "Passa a Premium"], chat: ["Scrivi ad AkılCEP…", "Ti ascolto…", "Nuova chat", "Invia"] }),
  pt: defineCore({ core: ["Inteligência no seu bolso", "Bem-vindo"], common: ["Cancelar", "OK", "Tentar novamente", "Fechar"], language: ["Idioma do aplicativo", "Escolha seu idioma preferido", "A alteração aplica-se instantaneamente a todas as telas."], navigation: ["Início", "Chat", "Configurações", "Perfil", "Voltar"], settings: ["Aparência", "Notificações", "Privacidade", "Sair"], profile: ["Nome", "E-mail", "Plano gratuito", "Mudar para Premium"], chat: ["Escreva para AkılCEP…", "Estou ouvindo…", "Novo chat", "Enviar"] }),
  ru: defineCore({ core: ["Разум в вашем кармане", "Добро пожаловать"], common: ["Отмена", "ОК", "Повторить", "Закрыть"], language: ["Язык приложения", "Выберите предпочитаемый язык", "Изменение сразу применяется на всех экранах."], navigation: ["Главная", "Чат", "Настройки", "Профиль", "Назад"], settings: ["Внешний вид", "Уведомления", "Конфиденциальность", "Выйти"], profile: ["Имя", "Электронная почта", "Бесплатный план", "Перейти на Premium"], chat: ["Напишите AkılCEP…", "Слушаю…", "Новый чат", "Отправить"] }),
  uk: defineCore({ core: ["Інтелект у вашій кишені", "Ласкаво просимо"], common: ["Скасувати", "OK", "Повторити", "Закрити"], language: ["Мова застосунку", "Виберіть бажану мову", "Зміна миттєво застосовується на всіх екранах."], navigation: ["Головна", "Чат", "Налаштування", "Профіль", "Назад"], settings: ["Вигляд", "Сповіщення", "Конфіденційність", "Вийти"], profile: ["Ім’я", "Електронна пошта", "Безкоштовний план", "Перейти на Premium"], chat: ["Напишіть AkılCEP…", "Слухаю…", "Новий чат", "Надіслати"] }),
  pl: defineCore({ core: ["Inteligencja w kieszeni", "Witaj"], common: ["Anuluj", "OK", "Spróbuj ponownie", "Zamknij"], language: ["Język aplikacji", "Wybierz preferowany język", "Zmiana jest natychmiast stosowana na wszystkich ekranach."], navigation: ["Start", "Czat", "Ustawienia", "Profil", "Wstecz"], settings: ["Wygląd", "Powiadomienia", "Prywatność", "Wyloguj"], profile: ["Imię", "E-mail", "Darmowy plan", "Przejdź na Premium"], chat: ["Napisz do AkılCEP…", "Słucham…", "Nowy czat", "Wyślij"] }),
  nl: defineCore({ core: ["Intelligentie in je zak", "Welkom"], common: ["Annuleren", "OK", "Opnieuw proberen", "Sluiten"], language: ["App-taal", "Kies je voorkeurstaal", "De wijziging wordt direct op alle schermen toegepast."], navigation: ["Home", "Chat", "Instellingen", "Profiel", "Terug"], settings: ["Weergave", "Meldingen", "Privacy", "Uitloggen"], profile: ["Naam", "E-mail", "Gratis abonnement", "Upgraden naar Premium"], chat: ["Schrijf aan AkılCEP…", "Ik luister…", "Nieuwe chat", "Versturen"] }),
  sv: defineCore({ core: ["Intelligens i fickan", "Välkommen"], common: ["Avbryt", "OK", "Försök igen", "Stäng"], language: ["Appens språk", "Välj önskat språk", "Ändringen gäller direkt på alla skärmar."], navigation: ["Hem", "Chatt", "Inställningar", "Profil", "Tillbaka"], settings: ["Utseende", "Notiser", "Integritet", "Logga ut"], profile: ["Namn", "E-post", "Gratisplan", "Uppgradera till Premium"], chat: ["Skriv till AkılCEP…", "Jag lyssnar…", "Ny chatt", "Skicka"] }),
  no: defineCore({ core: ["Intelligens i lommen", "Velkommen"], common: ["Avbryt", "OK", "Prøv igjen", "Lukk"], language: ["Appspråk", "Velg ønsket språk", "Endringen gjelder umiddelbart på alle skjermer."], navigation: ["Hjem", "Chat", "Innstillinger", "Profil", "Tilbake"], settings: ["Utseende", "Varsler", "Personvern", "Logg ut"], profile: ["Navn", "E-post", "Gratisabonnement", "Oppgrader til Premium"], chat: ["Skriv til AkılCEP…", "Jeg lytter…", "Ny chat", "Send"] }),
  da: defineCore({ core: ["Intelligens i lommen", "Velkommen"], common: ["Annuller", "OK", "Prøv igen", "Luk"], language: ["Appens sprog", "Vælg dit foretrukne sprog", "Ændringen anvendes med det samme på alle skærme."], navigation: ["Hjem", "Chat", "Indstillinger", "Profil", "Tilbage"], settings: ["Udseende", "Notifikationer", "Privatliv", "Log ud"], profile: ["Navn", "E-mail", "Gratis abonnement", "Opgrader til Premium"], chat: ["Skriv til AkılCEP…", "Jeg lytter…", "Ny chat", "Send"] }),
  fi: defineCore({ core: ["Älykkyys taskussasi", "Tervetuloa"], common: ["Peruuta", "OK", "Yritä uudelleen", "Sulje"], language: ["Sovelluksen kieli", "Valitse haluamasi kieli", "Muutos otetaan heti käyttöön kaikissa näkymissä."], navigation: ["Koti", "Chat", "Asetukset", "Profiili", "Takaisin"], settings: ["Ulkoasu", "Ilmoitukset", "Tietosuoja", "Kirjaudu ulos"], profile: ["Nimi", "Sähköposti", "Ilmainen paketti", "Päivitä Premiumiin"], chat: ["Kirjoita AkılCEPille…", "Kuuntelen…", "Uusi chat", "Lähetä"] }),
  el: defineCore({ core: ["Νοημοσύνη στην τσέπη σας", "Καλώς ήρθατε"], common: ["Ακύρωση", "OK", "Δοκιμή ξανά", "Κλείσιμο"], language: ["Γλώσσα εφαρμογής", "Επιλέξτε τη γλώσσα σας", "Η αλλαγή εφαρμόζεται αμέσως σε όλες τις οθόνες."], navigation: ["Αρχική", "Συνομιλία", "Ρυθμίσεις", "Προφίλ", "Πίσω"], settings: ["Εμφάνιση", "Ειδοποιήσεις", "Απόρρητο", "Αποσύνδεση"], profile: ["Όνομα", "E-mail", "Δωρεάν πρόγραμμα", "Αναβάθμιση σε Premium"], chat: ["Γράψτε στο AkılCEP…", "Ακούω…", "Νέα συνομιλία", "Αποστολή"] }),
  cs: defineCore({ core: ["Inteligence v kapse", "Vítejte"], common: ["Zrušit", "OK", "Zkusit znovu", "Zavřít"], language: ["Jazyk aplikace", "Vyberte preferovaný jazyk", "Změna se okamžitě použije na všech obrazovkách."], navigation: ["Domů", "Chat", "Nastavení", "Profil", "Zpět"], settings: ["Vzhled", "Oznámení", "Soukromí", "Odhlásit"], profile: ["Jméno", "E-mail", "Bezplatný plán", "Přejít na Premium"], chat: ["Napište AkılCEP…", "Poslouchám…", "Nový chat", "Odeslat"] }),
  sk: defineCore({ core: ["Inteligencia vo vrecku", "Vitajte"], common: ["Zrušiť", "OK", "Skúsiť znova", "Zavrieť"], language: ["Jazyk aplikácie", "Vyberte preferovaný jazyk", "Zmena sa okamžite použije na všetkých obrazovkách."], navigation: ["Domov", "Chat", "Nastavenia", "Profil", "Späť"], settings: ["Vzhľad", "Oznámenia", "Súkromie", "Odhlásiť"], profile: ["Meno", "E-mail", "Bezplatný plán", "Prejsť na Premium"], chat: ["Napíšte AkılCEP…", "Počúvam…", "Nový chat", "Odoslať"] }),
  hu: defineCore({ core: ["Intelligencia a zsebedben", "Üdvözlünk"], common: ["Mégse", "OK", "Újra", "Bezárás"], language: ["Alkalmazás nyelve", "Válaszd ki a kívánt nyelvet", "A módosítás azonnal érvényesül minden képernyőn."], navigation: ["Kezdőlap", "Csevegés", "Beállítások", "Profil", "Vissza"], settings: ["Megjelenés", "Értesítések", "Adatvédelem", "Kijelentkezés"], profile: ["Név", "E-mail", "Ingyenes csomag", "Váltás Premiumra"], chat: ["Írj az AkılCEPnek…", "Figyelek…", "Új csevegés", "Küldés"] }),
  ro: defineCore({ core: ["Inteligență în buzunar", "Bine ai venit"], common: ["Anulează", "OK", "Încearcă din nou", "Închide"], language: ["Limba aplicației", "Alege limba preferată", "Schimbarea se aplică instantaneu pe toate ecranele."], navigation: ["Acasă", "Chat", "Setări", "Profil", "Înapoi"], settings: ["Aspect", "Notificări", "Confidențialitate", "Deconectare"], profile: ["Nume", "E-mail", "Plan gratuit", "Treci la Premium"], chat: ["Scrie către AkılCEP…", "Te ascult…", "Chat nou", "Trimite"] }),
  bg: defineCore({ core: ["Интелигентност в джоба ви", "Добре дошли"], common: ["Отказ", "OK", "Опитай отново", "Затвори"], language: ["Език на приложението", "Изберете предпочитан език", "Промяната се прилага веднага на всички екрани."], navigation: ["Начало", "Чат", "Настройки", "Профил", "Назад"], settings: ["Изглед", "Известия", "Поверителност", "Изход"], profile: ["Име", "Имейл", "Безплатен план", "Премини към Premium"], chat: ["Пишете на AkılCEP…", "Слушам…", "Нов чат", "Изпрати"] }),
  sr: defineCore({ core: ["Интелигенција у вашем џепу", "Добродошли"], common: ["Откажи", "У реду", "Покушај поново", "Затвори"], language: ["Језик апликације", "Изаберите жељени језик", "Промена се одмах примењује на свим екранима."], navigation: ["Почетна", "Ћаскање", "Подешавања", "Профил", "Назад"], settings: ["Изглед", "Обавештења", "Приватност", "Одјави се"], profile: ["Име", "Е-пошта", "Бесплатни план", "Пређи на Premium"], chat: ["Пишите AkılCEP-у…", "Слушам…", "Ново ћаскање", "Пошаљи"] }),
  hr: defineCore({ core: ["Inteligencija u džepu", "Dobro došli"], common: ["Odustani", "U redu", "Pokušaj ponovno", "Zatvori"], language: ["Jezik aplikacije", "Odaberite željeni jezik", "Promjena se odmah primjenjuje na svim zaslonima."], navigation: ["Početna", "Razgovor", "Postavke", "Profil", "Natrag"], settings: ["Izgled", "Obavijesti", "Privatnost", "Odjava"], profile: ["Ime", "E-pošta", "Besplatni plan", "Nadogradi na Premium"], chat: ["Pišite AkılCEPu…", "Slušam…", "Novi razgovor", "Pošalji"] }),
  sl: defineCore({ core: ["Inteligenca v vašem žepu", "Dobrodošli"], common: ["Prekliči", "V redu", "Poskusi znova", "Zapri"], language: ["Jezik aplikacije", "Izberite želeni jezik", "Sprememba se takoj uporabi na vseh zaslonih."], navigation: ["Domov", "Klepet", "Nastavitve", "Profil", "Nazaj"], settings: ["Videz", "Obvestila", "Zasebnost", "Odjava"], profile: ["Ime", "E-pošta", "Brezplačni paket", "Nadgradi na Premium"], chat: ["Pišite AkılCEPu…", "Poslušam…", "Nov klepet", "Pošlji"] }),
  lt: defineCore({ core: ["Išmintis jūsų kišenėje", "Sveiki"], common: ["Atšaukti", "Gerai", "Bandyti dar kartą", "Uždaryti"], language: ["Programėlės kalba", "Pasirinkite norimą kalbą", "Pakeitimas iškart taikomas visuose ekranuose."], navigation: ["Pradžia", "Pokalbis", "Nustatymai", "Profilis", "Atgal"], settings: ["Išvaizda", "Pranešimai", "Privatumas", "Atsijungti"], profile: ["Vardas", "El. paštas", "Nemokamas planas", "Naujovinti į Premium"], chat: ["Rašykite AkılCEP…", "Klausausi…", "Naujas pokalbis", "Siųsti"] }),
  lv: defineCore({ core: ["Gudrība jūsu kabatā", "Laipni lūdzam"], common: ["Atcelt", "Labi", "Mēģināt vēlreiz", "Aizvērt"], language: ["Lietotnes valoda", "Izvēlieties vēlamo valodu", "Izmaiņas uzreiz tiek lietotas visos ekrānos."], navigation: ["Sākums", "Tērzēšana", "Iestatījumi", "Profils", "Atpakaļ"], settings: ["Izskats", "Paziņojumi", "Privātums", "Izrakstīties"], profile: ["Vārds", "E-pasts", "Bezmaksas plāns", "Jaunināt uz Premium"], chat: ["Rakstiet AkılCEP…", "Klausos…", "Jauna tērzēšana", "Sūtīt"] }),
  et: defineCore({ core: ["Tarkus sinu taskus", "Tere tulemast"], common: ["Tühista", "Sobib", "Proovi uuesti", "Sulge"], language: ["Rakenduse keel", "Valige eelistatud keel", "Muudatus rakendub kohe kõigil ekraanidel."], navigation: ["Avaleht", "Vestlus", "Seaded", "Profiil", "Tagasi"], settings: ["Välimus", "Teavitused", "Privaatsus", "Logi välja"], profile: ["Nimi", "E-post", "Tasuta pakett", "Uuenda Premiumile"], chat: ["Kirjuta AkılCEP-ile…", "Kuulan…", "Uus vestlus", "Saada"] }),
  bs: defineCore({ core: ["Inteligencija u džepu", "Dobro došli"], common: ["Otkaži", "U redu", "Pokušaj ponovo", "Zatvori"], language: ["Jezik aplikacije", "Izaberite željeni jezik", "Promjena se odmah primjenjuje na svim ekranima."], navigation: ["Početna", "Čet", "Postavke", "Profil", "Nazad"], settings: ["Izgled", "Obavijesti", "Privatnost", "Odjava"], profile: ["Ime", "E-pošta", "Besplatni paket", "Pređi na Premium"], chat: ["Pišite AkılCEPu…", "Slušam…", "Novi čet", "Pošalji"] }),
  sq: defineCore({ core: ["Inteligjenca në xhepin tuaj", "Mirë se vini"], common: ["Anulo", "OK", "Provo përsëri", "Mbyll"], language: ["Gjuha e aplikacionit", "Zgjidhni gjuhën tuaj", "Ndryshimi zbatohet menjëherë në të gjitha ekranet."], navigation: ["Kryefaqja", "Biseda", "Cilësimet", "Profili", "Prapa"], settings: ["Pamja", "Njoftimet", "Privatësia", "Dil"], profile: ["Emri", "E-mail", "Plani falas", "Përmirëso në Premium"], chat: ["Shkruajini AkılCEP…", "Po dëgjoj…", "Bisedë e re", "Dërgo"] }),
  mk: defineCore({ core: ["Интелигенција во вашиот џеб", "Добредојдовте"], common: ["Откажи", "Во ред", "Обиди се повторно", "Затвори"], language: ["Јазик на апликацијата", "Изберете го саканиот јазик", "Промената веднаш се применува на сите екрани."], navigation: ["Почетна", "Разговор", "Поставки", "Профил", "Назад"], settings: ["Изглед", "Известувања", "Приватност", "Одјави се"], profile: ["Име", "Е-пошта", "Бесплатен план", "Надгради на Premium"], chat: ["Пишете му на AkılCEP…", "Слушам…", "Нов разговор", "Испрати"] }),
  he: defineCore({ core: ["בינה בכיס שלך", "ברוכים הבאים"], common: ["ביטול", "אישור", "נסה שוב", "סגור"], language: ["שפת האפליקציה", "בחרו את השפה המועדפת עליכם", "השינוי חל מיד בכל המסכים."], navigation: ["בית", "צ׳אט", "הגדרות", "פרופיל", "חזרה"], settings: ["מראה", "התראות", "פרטיות", "התנתקות"], profile: ["שם", "דוא״ל", "מסלול חינמי", "שדרוג ל‑Premium"], chat: ["כתבו ל‑AkılCEP…", "אני מקשיב…", "צ׳אט חדש", "שליחה"] }),
  ar: defineCore({ core: ["الذكاء في جيبك", "مرحبًا بك"], common: ["إلغاء", "موافق", "حاول مرة أخرى", "إغلاق"], language: ["لغة التطبيق", "اختر لغتك المفضلة", "يُطبّق التغيير فورًا على جميع الشاشات."], navigation: ["الرئيسية", "المحادثة", "الإعدادات", "الملف الشخصي", "رجوع"], settings: ["المظهر", "الإشعارات", "الخصوصية", "تسجيل الخروج"], profile: ["الاسم", "البريد الإلكتروني", "الخطة المجانية", "الترقية إلى Premium"], chat: ["اكتب إلى AkılCEP…", "أنا أستمع…", "محادثة جديدة", "إرسال"] }),
  fa: defineCore({ core: ["هوش در جیب شما", "خوش آمدید"], common: ["لغو", "تأیید", "تلاش دوباره", "بستن"], language: ["زبان برنامه", "زبان دلخواه خود را انتخاب کنید", "تغییر زبان فوراً در همه صفحه‌ها اعمال می‌شود."], navigation: ["خانه", "گفت‌وگو", "تنظیمات", "نمایه", "بازگشت"], settings: ["ظاهر", "اعلان‌ها", "حریم خصوصی", "خروج"], profile: ["نام", "ایمیل", "طرح رایگان", "ارتقا به Premium"], chat: ["برای AkılCEP بنویسید…", "گوش می‌دهم…", "گفت‌وگوی جدید", "ارسال"] }),
  hi: defineCore({ core: ["आपकी जेब में बुद्धिमत्ता", "स्वागत है"], common: ["रद्द करें", "ठीक है", "फिर कोशिश करें", "बंद करें"], language: ["ऐप की भाषा", "अपनी पसंदीदा भाषा चुनें", "बदलाव सभी स्क्रीन पर तुरंत लागू होता है।"], navigation: ["होम", "चैट", "सेटिंग्स", "प्रोफ़ाइल", "वापस"], settings: ["दिखावट", "सूचनाएँ", "गोपनीयता", "साइन आउट"], profile: ["नाम", "ईमेल", "मुफ़्त प्लान", "Premium पर जाएँ"], chat: ["AkılCEP को लिखें…", "मैं सुन रहा हूँ…", "नई चैट", "भेजें"] }),
  bn: defineCore({ core: ["আপনার পকেটে বুদ্ধিমত্তা", "স্বাগতম"], common: ["বাতিল", "ঠিক আছে", "আবার চেষ্টা করুন", "বন্ধ করুন"], language: ["অ্যাপের ভাষা", "আপনার পছন্দের ভাষা বেছে নিন", "পরিবর্তনটি সব স্ক্রিনে তাৎক্ষণিকভাবে প্রয়োগ হবে।"], navigation: ["হোম", "চ্যাট", "সেটিংস", "প্রোফাইল", "পেছনে"], settings: ["চেহারা", "বিজ্ঞপ্তি", "গোপনীয়তা", "সাইন আউট"], profile: ["নাম", "ইমেল", "বিনামূল্যের প্ল্যান", "Premium-এ আপগ্রেড"], chat: ["AkılCEP-কে লিখুন…", "আমি শুনছি…", "নতুন চ্যাট", "পাঠান"] }),
  ur: defineCore({ core: ["آپ کی جیب میں ذہانت", "خوش آمدید"], common: ["منسوخ", "ٹھیک ہے", "دوبارہ کوشش کریں", "بند کریں"], language: ["ایپ کی زبان", "اپنی پسندیدہ زبان منتخب کریں", "تبدیلی تمام اسکرینز پر فوراً لاگو ہوتی ہے۔"], navigation: ["ہوم", "چیٹ", "ترتیبات", "پروفائل", "واپس"], settings: ["ظاہری شکل", "اطلاعات", "رازداری", "سائن آؤٹ"], profile: ["نام", "ای میل", "مفت پلان", "Premium پر اپ گریڈ"], chat: ["AkılCEP کو لکھیں…", "میں سن رہا ہوں…", "نئی چیٹ", "بھیجیں"] }),
  zh: defineCore({ core: ["口袋里的智能", "欢迎"], common: ["取消", "好的", "重试", "关闭"], language: ["应用语言", "选择您的首选语言", "语言更改会立即应用到所有页面。"], navigation: ["首页", "聊天", "设置", "个人资料", "返回"], settings: ["外观", "通知", "隐私", "退出登录"], profile: ["姓名", "电子邮箱", "免费方案", "升级 Premium"], chat: ["给 AkılCEP 发消息…", "我在听…", "新聊天", "发送"] }),
  ja: defineCore({ core: ["ポケットの中の知性", "ようこそ"], common: ["キャンセル", "OK", "再試行", "閉じる"], language: ["アプリの言語", "希望する言語を選択", "変更はすべての画面にすぐ反映されます。"], navigation: ["ホーム", "チャット", "設定", "プロフィール", "戻る"], settings: ["外観", "通知", "プライバシー", "ログアウト"], profile: ["名前", "メール", "無料プラン", "Premium にアップグレード"], chat: ["AkılCEP に入力…", "聞いています…", "新しいチャット", "送信"] }),
  ko: defineCore({ core: ["주머니 속의 지능", "환영합니다"], common: ["취소", "확인", "다시 시도", "닫기"], language: ["앱 언어", "원하는 언어를 선택하세요", "변경 사항은 모든 화면에 즉시 적용됩니다."], navigation: ["홈", "채팅", "설정", "프로필", "뒤로"], settings: ["화면", "알림", "개인정보", "로그아웃"], profile: ["이름", "이메일", "무료 요금제", "Premium으로 업그레이드"], chat: ["AkılCEP에 입력…", "듣고 있어요…", "새 채팅", "보내기"] }),
  vi: defineCore({ core: ["Trí tuệ trong túi bạn", "Chào mừng"], common: ["Hủy", "OK", "Thử lại", "Đóng"], language: ["Ngôn ngữ ứng dụng", "Chọn ngôn ngữ ưa thích", "Thay đổi được áp dụng ngay trên mọi màn hình."], navigation: ["Trang chủ", "Trò chuyện", "Cài đặt", "Hồ sơ", "Quay lại"], settings: ["Giao diện", "Thông báo", "Quyền riêng tư", "Đăng xuất"], profile: ["Tên", "Email", "Gói miễn phí", "Nâng cấp Premium"], chat: ["Viết cho AkılCEP…", "Tôi đang nghe…", "Cuộc trò chuyện mới", "Gửi"] }),
  th: defineCore({ core: ["ปัญญาในกระเป๋าของคุณ", "ยินดีต้อนรับ"], common: ["ยกเลิก", "ตกลง", "ลองอีกครั้ง", "ปิด"], language: ["ภาษาของแอป", "เลือกภาษาที่คุณต้องการ", "การเปลี่ยนแปลงมีผลทันทีในทุกหน้าจอ"], navigation: ["หน้าหลัก", "แชต", "การตั้งค่า", "โปรไฟล์", "ย้อนกลับ"], settings: ["รูปลักษณ์", "การแจ้งเตือน", "ความเป็นส่วนตัว", "ออกจากระบบ"], profile: ["ชื่อ", "อีเมล", "แผนฟรี", "อัปเกรดเป็น Premium"], chat: ["เขียนถึง AkılCEP…", "กำลังฟัง…", "แชตใหม่", "ส่ง"] }),
  id: defineCore({ core: ["Kecerdasan dalam genggaman", "Selamat datang"], common: ["Batal", "OK", "Coba lagi", "Tutup"], language: ["Bahasa aplikasi", "Pilih bahasa pilihan Anda", "Perubahan langsung diterapkan di semua layar."], navigation: ["Beranda", "Chat", "Pengaturan", "Profil", "Kembali"], settings: ["Tampilan", "Notifikasi", "Privasi", "Keluar"], profile: ["Nama", "Email", "Paket gratis", "Tingkatkan ke Premium"], chat: ["Tulis kepada AkılCEP…", "Saya mendengarkan…", "Chat baru", "Kirim"] }),
  ms: defineCore({ core: ["Kecerdasan dalam poket anda", "Selamat datang"], common: ["Batal", "OK", "Cuba lagi", "Tutup"], language: ["Bahasa aplikasi", "Pilih bahasa pilihan anda", "Perubahan digunakan serta-merta pada semua skrin."], navigation: ["Utama", "Sembang", "Tetapan", "Profil", "Kembali"], settings: ["Penampilan", "Pemberitahuan", "Privasi", "Log keluar"], profile: ["Nama", "E-mel", "Pelan percuma", "Naik taraf ke Premium"], chat: ["Tulis kepada AkılCEP…", "Saya sedang mendengar…", "Sembang baharu", "Hantar"] }),
  fil: defineCore({ core: ["Katalinuhan sa iyong bulsa", "Maligayang pagdating"], common: ["Kanselahin", "OK", "Subukan muli", "Isara"], language: ["Wika ng app", "Piliin ang iyong gustong wika", "Agad na ilalapat ang pagbabago sa lahat ng screen."], navigation: ["Home", "Chat", "Mga setting", "Profile", "Bumalik"], settings: ["Hitsura", "Mga notification", "Privacy", "Mag-sign out"], profile: ["Pangalan", "Email", "Libreng plano", "Mag-upgrade sa Premium"], chat: ["Sumulat kay AkılCEP…", "Nakikinig ako…", "Bagong chat", "Ipadala"] }),
};
