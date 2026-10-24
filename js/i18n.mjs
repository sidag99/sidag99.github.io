// English is written in index.html; this file holds the German version of the page and the language switch.
// Static text is matched by its English HTML, so the markup needs no keys.

const STORAGE_KEY = 'lang';
const listeners = [];
let lang = initialLang();

function initialLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'de' || fromUrl === 'en') return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch { /* storage can be blocked; fall through */ }
  return (navigator.languages || [navigator.language]).some(l => /^de\b/i.test(l || '')) ? 'de' : 'en';
}

export const getLang = () => lang;
export const tr = (en, de) => (lang === 'de' ? de : en);
export const locale = () => (lang === 'de' ? 'de-DE' : 'en');
export const onLangChange = fn => listeners.push(fn);

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* not essential */ }
  applyPage();
  listeners.forEach(fn => fn(next));
}

/* ---------- page text: English HTML → German HTML ---------- */
const PAGE_DE = {
  'Skip to content': 'Zum Inhalt springen',
  'Work': 'Erfahrung',
  'Playground<span class="dot" aria-hidden="true"></span>': 'Experimente<span class="dot" aria-hidden="true"></span>',
  'About': 'Über mich',
  'Jump to anything <kbd>⌘ / Ctrl K</kbd>': 'Schnell springen <kbd>⌘ / Strg K</kbd>',
  'Let’s talk<span aria-hidden="true">↗</span>': 'Kontakt<span aria-hidden="true">↗</span>',

  // hero
  'Full-stack engineer.<br><em>Curious by default.</em>': 'Full-Stack-Entwickler.<br><em>Neugierig aus Prinzip.</em>',
  'I’m Siddharth. I spent four years shipping a Jira-integrated SaaS product in Java, TypeScript and Vue.js. Now I build applied and agentic AI while studying Data Science at TU&nbsp;Darmstadt.':
    'Ich bin Siddharth. Vier Jahre lang habe ich ein in Jira integriertes SaaS-Produkt mit Java, TypeScript und Vue.js entwickelt. Heute studiere ich Data Science an der TU&nbsp;Darmstadt und baue Anwendungen mit angewandter und agentischer KI.',
  '<span class="dot" aria-hidden="true"></span>Open to Werkstudent roles and internships in Germany': '<span class="dot" aria-hidden="true"></span>Offen für Werkstudentenstellen und Praktika in Deutschland',
  'Explore my work <span aria-hidden="true">↘</span>': 'Meine Arbeit ansehen <span aria-hidden="true">↘</span>',
  'Enter the playground': 'Zu den Experimenten',
  'Download résumé ↓': 'Lebenslauf herunterladen (EN) ↓',
  'THE PERSONAL LAB': 'DAS PERSÖNLICHE LABOR',
  'BUILD': 'BAUEN',
  'EXPLORE': 'ENTDECKEN',
  'ITERATE': 'VERBESSERN',
  'IDEAS ↔ EXPERIMENTS ↔ SOFTWARE': 'IDEEN ↔ EXPERIMENTE ↔ SOFTWARE',

  // work
  '01 / Selected experience': '01 / Berufserfahrung',
  'From the interface<br>to the <em>database.</em>': 'Von der Oberfläche<br>bis zur <em>Datenbank.</em>',
  'Four years building B2B software at Navarambh, and an internship in test automation before that.': 'Vier Jahre B2B-Software bei Navarambh, davor ein Praktikum in der Testautomatisierung.',
  'Jul 2021 — Oct 2025': 'Jul 2021 — Okt 2025',
  'Navarambh Software Pvt. Ltd. · India': 'Navarambh Software Pvt. Ltd. · Indien',
  'AIO Tests is a test management app that runs inside Jira, listed on the Atlassian Marketplace. QA teams use it to write test cases (including with AI), run test cycles, track defects and report on testing without leaving Jira.':
    'AIO Tests ist eine Testmanagement-App, die direkt in Jira läuft und im Atlassian Marketplace erhältlich ist. QA-Teams schreiben damit Testfälle (auch mit KI), führen Testzyklen durch, verfolgen Fehler und werten ihre Tests aus, ohne Jira zu verlassen.',
  'Rebuilding the frontend foundation<small>Vue 3 migration · 100+ components</small>': 'Das Frontend neu aufgestellt<small>Migration auf Vue 3 · 100+ Komponenten</small>',
  'Led the move from Vue&nbsp;2 to Vue&nbsp;3 and TypeScript, reworking 100+ components and bringing in Quasar so the frontend could keep evolving.':
    'Die Umstellung von Vue&nbsp;2 auf Vue&nbsp;3 und TypeScript geleitet: über 100 Komponenten überarbeitet und Quasar eingeführt, damit sich das Frontend weiterentwickeln kann.',
  'Built 50+ reusable UI components used across the product’s main modules.': 'Über 50 wiederverwendbare UI-Komponenten gebaut, die in den Hauptmodulen des Produkts im Einsatz sind.',
  'Focus / component architecture &amp; maintainability': 'Fokus / Komponentenarchitektur &amp; Wartbarkeit',
  'Making data move faster<small>Up to 40% faster workflows</small>': 'Schnellere Datenwege<small>Bis zu 40&nbsp;% schnellere Abläufe</small>',
  'Cut load times on key workflows by up to 40% by merging APIs and rewriting heavy queries with Querydsl.': 'Ladezeiten wichtiger Abläufe um bis zu 40&nbsp;% gesenkt, indem ich APIs zusammengeführt und aufwendige Abfragen mit Querydsl neu geschrieben habe.',
  'Owned Java services for large PDF exports, data import/export and migrations between product versions.': 'Verantwortlich für Java-Services für große PDF-Exporte, Datenimport und -export sowie Migrationen zwischen Produktversionen.',
  'Focus / backend services &amp; query optimisation': 'Fokus / Backend-Services &amp; Abfrageoptimierung',
  'Bringing AI into real workflows<small>Generative AI features in production</small>': 'KI in echte Arbeitsabläufe gebracht<small>Generative KI-Funktionen im Produktivbetrieb</small>',
  'Took generative AI features on Azure OpenAI from prompt design to production; they became part of how new customers were won.': 'Generative KI-Funktionen auf Azure OpenAI vom Prompt-Design bis in die Produktion gebracht; sie haben geholfen, neue Kunden zu gewinnen.',
  'Used the Atlassian APIs so users could create Jira issues and see test data without leaving their workflow.': 'Über die Atlassian-APIs Funktionen gebaut, mit denen Nutzer Jira-Issues anlegen und Testdaten sehen, ohne ihren Arbeitsablauf zu verlassen.',
  'Focus / applied AI &amp; product engineering': 'Fokus / angewandte KI &amp; Produktentwicklung',
  'Before that: SDET intern at Frugal Testing<small>Load tests at 1,000+ concurrent users</small>': 'Davor: SDET-Praktikant bei Frugal Testing<small>Lasttests mit über 1.000 gleichzeitigen Nutzern</small>',
  'Load-tested auction sites and banking portals with JMeter at 1,000+ concurrent users and helped tune them.': 'Auktionsseiten und Bankportale mit JMeter unter Last von über 1.000 gleichzeitigen Nutzern getestet und bei der Optimierung geholfen.',
  'Wrote end-to-end Selenium suites in Java that widened test coverage.': 'End-to-End-Testsuiten mit Selenium in Java geschrieben, die die Testabdeckung erweitert haben.',
  'Interviewed 20+ candidates and mentored the next group of interns on test automation.': 'Über 20 Bewerbungsgespräche geführt und die nächste Praktikantengruppe in Testautomatisierung betreut.',
  'Jan — Jun 2021 · India': 'Jan — Jun 2021 · Indien',
  'Experience and metrics from my résumé. Employer source code isn’t published here.': 'Erfahrung und Kennzahlen stammen aus meinem Lebenslauf. Quellcode meines Arbeitgebers wird hier nicht veröffentlicht.',

  // code mode
  '02 / Recent project': '02 / Aktuelles Projekt',
  'Code Mode for<br><em>AnythingMCP.</em>': 'Code Mode für<br><em>AnythingMCP.</em>',
  'Black Forest Hackathon, Oct 2026 · Team of five · Challenge set by KOCH Freiburg GmbH': 'Black Forest Hackathon, Okt 2026 · Fünferteam · Aufgabe von KOCH Freiburg GmbH',
  'The problem': 'Das Problem',
  'AI agents that call business tools directly tend to pull whole tables into their context. That is slow, expensive, and often leaks data the agent never needed.':
    'KI-Agenten, die Geschäftstools direkt aufrufen, ziehen oft ganze Tabellen in ihren Kontext. Das ist langsam, teuer und gibt häufig Daten preis, die der Agent gar nicht braucht.',
  'What we built': 'Was wir gebaut haben',
  'A sandbox for AnythingMCP, an open-source MCP gateway. The agent writes a short JavaScript script, the script runs next to the connectors in an isolated V8 sandbox, and only the final answer goes back to the model.':
    'Eine Sandbox für AnythingMCP, ein Open-Source-MCP-Gateway. Der Agent schreibt ein kurzes JavaScript-Skript, das in einer isolierten V8-Sandbox direkt neben den Konnektoren läuft, und nur die fertige Antwort geht zurück an das Modell.',
  'The hardest part': 'Die größte Herausforderung',
  'Understanding the problem. KOCH wanted permissions and different levels of access built in, so we had to find a design that worked well, looked good and fit their setup, while still covering everything they expected.':
    'Das Problem wirklich zu verstehen. KOCH wollte Berechtigungen und verschiedene Zugriffsebenen eingebaut haben. Wir mussten also eine Lösung finden, die gut funktioniert, gut aussieht und zu ihrem Setup passt und trotzdem alles abdeckt, was sie erwartet haben.',
  'The tradeoff': 'Die Abwägung',
  'Keeping data out of the model means running code the model wrote. So the sandbox gets the user’s own permissions and nothing more: it refuses writes, has no network access or secrets, cannot reach other tenants, and stops runaway scripts.':
    'Wer Daten vom Modell fernhält, muss Code ausführen, den das Modell geschrieben hat. Deshalb bekommt die Sandbox genau die Rechte des Nutzers und nicht mehr: Sie verweigert Schreibzugriffe, hat keinen Netzwerkzugang und keine Secrets, erreicht keine anderen Mandanten und stoppt außer Kontrolle geratene Skripte.',
  'My part': 'Mein Beitrag',
  'I broke down the challenge and decided with the team what to build, steered the build (much of the code was written with AI coding agents), and debugged and fixed the issues that came up on the way to a working demo.':
    'Ich habe die Aufgabe analysiert und mit dem Team entschieden, was wir bauen, die Umsetzung gesteuert (ein Großteil des Codes entstand mit KI-Coding-Agenten) und die Probleme auf dem Weg zur funktionierenden Demo gefunden und behoben.',
  '1.69 MB → 41 B': '1,69 MB → 41 B',
  'raw tool output vs. Code Mode answer on one query': 'rohe Tool-Ausgabe vs. Code-Mode-Antwort bei einer Abfrage',
  '5th of 14': 'Platz 5 von 14',
  'final ranking': 'Endplatzierung',
  '3 days': '3 Tage',
  '16–18 Oct 2026': '16.–18. Okt 2026',
  'Run it on toy data <span aria-hidden="true">↗</span>': 'Mit Spieldaten ausprobieren <span aria-hidden="true">↗</span>',
  'Agent is asked: <b>“What happened to order 12345?”</b>': 'Der Agent wird gefragt: <b>„Was ist mit Bestellung 12345 passiert?“</b>',
  'Raw tool calls': 'Rohe Tool-Aufrufe',
  '1.69 MB': '1,69 MB',
  'Same answer, about 10 tokens instead of 422,500. From our hackathon benchmark.': 'Dieselbe Antwort, etwa 10 statt 422.500 Tokens. Aus unserem Hackathon-Benchmark.',

  // playground
  '03 / The playground': '03 / Experimente',
  'Small experiments,<br><em>run in your browser.</em>': 'Kleine Experimente,<br><em>direkt im Browser.</em>',
  'Four things to try, from the request timing behind my backend work to two game bots that explain their moves. No accounts, no setup.':
    'Vier Dinge zum Ausprobieren, vom Request-Timing hinter meiner Backend-Arbeit bis zu zwei Spiel-Bots, die ihre Züge erklären. Ohne Konto, ohne Einrichtung.',
  '01 / Systems': '01 / Systeme',
  'Where does the waiting happen?': 'Wo entsteht die Wartezeit?',
  'Change the workload and request strategy, then watch an interface get its data.': 'Ändern Sie Datenmenge und Request-Strategie und sehen Sie zu, wie eine Oberfläche ihre Daten lädt.',
  'Tune the requests <span aria-hidden="true">↗</span>': 'Requests optimieren <span aria-hidden="true">↗</span>',
  '02 / Game AI': '02 / Spiel-KI',
  'Two games, two kinds of bot.': 'Zwei Spiele, zwei Arten von Bot.',
  'Tic-tac-toe, solved completely. Connect Four, too big to solve, so its bot estimates. Both show their reasoning.': 'Tic-Tac-Toe, vollständig gelöst. Vier gewinnt, zu groß zum Lösen, also schätzt der Bot. Beide zeigen, wie sie denken.',
  'Play the games <span aria-hidden="true">↗</span>': 'Jetzt spielen <span aria-hidden="true">↗</span>',
  '03 / Algorithms': '03 / Algorithmen',
  'Find a way through.': 'Finden Sie den Weg.',
  'Draw a maze and watch breadth-first search and A* race for the shortest path.': 'Zeichnen Sie ein Labyrinth und sehen Sie zu, wie Breitensuche und A* um den kürzesten Weg wetteifern.',
  'Open the maze <span aria-hidden="true">↗</span>': 'Labyrinth öffnen <span aria-hidden="true">↗</span>',
  '04 / Guided assistant': '04 / Geführter Assistent',
  'What does Siddharth build?': 'Was baut Siddharth?',
  '✳ Glad you asked.': '✳ Gute Frage.',
  'Meet the engineer.': 'Lernen Sie mich kennen.',
  'Ask about my experience, AI work and skills. Prepared answers drawn from my résumé.': 'Fragen Sie nach meiner Erfahrung, meiner KI-Arbeit und meinen Fähigkeiten. Vorbereitete Antworten aus meinem Lebenslauf.',
  'Ask a question <span aria-hidden="true">↗</span>': 'Frage stellen <span aria-hidden="true">↗</span>',
  '<span class="dot" aria-hidden="true"></span>Made for this site with help from AI coding tools · Everything runs in your browser · The assistant gives prepared answers from my résumé, it isn’t a language model · <a class="link" href="https://github.com/sidag99/sidag99.github.io" rel="noopener">Source on GitHub</a>':
    '<span class="dot" aria-hidden="true"></span>Für diese Seite mit Hilfe von KI-Coding-Tools gebaut · Alles läuft in Ihrem Browser · Der Assistent gibt vorbereitete Antworten aus meinem Lebenslauf und ist kein Sprachmodell · <a class="link" href="https://github.com/sidag99/sidag99.github.io" rel="noopener">Quellcode auf GitHub</a>',

  // about
  '04 / A little context': '04 / Über mich',
  'An engineer.<br>A student. <em>A tinkerer.</em>': 'Entwickler.<br>Student. <em>Tüftler.</em>',
  'I like the part of engineering where a product gets noticeably better for the people using it.': 'Mich reizt der Teil der Entwicklung, in dem ein Produkt für seine Nutzer spürbar besser wird.',
  'A page that loads faster, a migration nobody has to think about afterwards, an AI feature that saves someone real work instead of just demoing well. That’s what four years on AIO Tests taught me to care about.':
    'Eine Seite, die schneller lädt, eine Migration, über die danach niemand mehr nachdenken muss, eine KI-Funktion, die echte Arbeit spart, statt nur in der Demo zu glänzen. Darauf zu achten, haben mich vier Jahre an AIO Tests gelehrt.',
  'Today I’m doing an MSc in Computer Science with a Data Science focus at TU&nbsp;Darmstadt, and exploring applied and agentic AI alongside it. I also love hackathons: an unfamiliar problem, a new team and a deadline measured in days. So far they’ve had me build everything from a gesture-controlled ATM PIN pad to a sandbox for AI agents.':
    'Heute mache ich meinen Master in Informatik mit Schwerpunkt Data Science an der TU&nbsp;Darmstadt und beschäftige mich nebenher mit angewandter und agentischer KI. Außerdem liebe ich Hackathons: ein unbekanntes Problem, ein neues Team und eine Deadline, die in Tagen gemessen wird. Dabei habe ich schon alles Mögliche gebaut, von einer gestengesteuerten PIN-Eingabe für Geldautomaten bis zu einer Sandbox für KI-Agenten.',
  'The full story, in one PDF ↓': 'Die ganze Geschichte als PDF (Englisch) ↓',
  '<strong>Winning ATM authentication prototype · Smart India Hackathon 2020</strong><br>First place for NCR Corporation’s problem statement NH447, with an ATM PIN entry system controlled by hand gestures.':
    '<strong>Siegerprototyp zur Authentifizierung am Geldautomaten · Smart India Hackathon 2020</strong><br>Erster Platz für die Aufgabe NH447 von NCR Corporation, mit einer PIN-Eingabe für Geldautomaten, die per Handgesten gesteuert wird.',
  'Along the way': 'Mein Weg',
  '2025 — now': '2025 — heute',
  'MSc, Computer Science': 'M.Sc. Informatik',
  'TU Darmstadt · Data Science focus': 'TU Darmstadt · Schwerpunkt Data Science',
  'Navarambh Software · AIO Tests for Jira': 'Navarambh Software · AIO Tests für Jira',
  'SDET Intern': 'SDET-Praktikant',
  'Frugal Testing · JMeter load tests and Java/Selenium automation': 'Frugal Testing · JMeter-Lasttests und Java/Selenium-Automatisierung',
  'BE, Computer Engineering': 'B.E. Technische Informatik',
  'Things I work with': 'Womit ich arbeite',
  'English (C1) · German (learning, B1)': 'Englisch (C1) · Deutsch (B1, ich lerne weiter)',
  'Earlier experiments': 'Frühere Projekte',
  '2020 / Robotics': '2020 / Robotik',
  '2019 / Augmented reality': '2019 / Augmented Reality',
  'A printer, connected.': 'Ein vernetzter Drucker.',
  'A working 3D printer set up for remote printing over the network with Raspberry Pi and OctoPi.': 'Ein funktionierender 3D-Drucker, eingerichtet für Druckaufträge übers Netzwerk mit Raspberry Pi und OctoPi.',
  'A bot with a route.': 'Ein Roboter mit Route.',
  'An autonomous line-following delivery robot using Arduino, ESP8266 and Firebase.': 'Ein autonomer, linienfolgender Lieferroboter mit Arduino, ESP8266 und Firebase.',
  'Plans with another dimension.': 'Pläne mit einer Dimension mehr.',
  'An Android app that places 3D floor plans on printed markers, built with Unity and Vuforia.': 'Eine Android-App, die 3D-Grundrisse auf gedruckten Markern einblendet, gebaut mit Unity und Vuforia.',

  // contact
  '05 / Let’s make something': '05 / Lassen Sie uns etwas bauen',
  'Looking for a Werkstudent or intern?<br><em>Let’s talk.</em>': 'Sie suchen einen Werkstudenten oder Praktikanten?<br><em>Lassen Sie uns sprechen.</em>',
  'Open to Werkstudent roles and internships in software engineering and AI, and to the right full-time role. As a Werkstudent I can work up to 20 hours a week during the semester and full-time in semester breaks. Based in Darmstadt.':
    'Offen für Werkstudentenstellen und Praktika in Softwareentwicklung und KI sowie für die passende Vollzeitstelle. Als Werkstudent kann ich im Semester bis zu 20 Stunden pro Woche arbeiten und in den Semesterferien in Vollzeit. Wohnhaft in Darmstadt.',
  'Say hello <span aria-hidden="true">↗</span>': 'Schreiben Sie mir <span aria-hidden="true">↗</span>',
  '© 2026 Siddharth Agarwal · No cookies, no analytics': '© 2026 Siddharth Agarwal · Keine Cookies, kein Tracking',
  'Résumé ↓': 'Lebenslauf (EN) ↓',
  'Back to top ↑': 'Nach oben ↑',

  // dialogs
  'The personal lab': 'Das persönliche Labor',
  'Follow your <em>curiosity.</em>': 'Folgen Sie Ihrer <em>Neugier.</em>',
  '↑ ↓ to move · Enter to open · Esc to close': '↑ ↓ zum Wechseln · Enter zum Öffnen · Esc zum Schließen'
};

const ATTR_DE = {
  'Siddharth Agarwal, back to top': 'Siddharth Agarwal, nach oben',
  'Main': 'Hauptnavigation',
  'Code Mode example: an agent writes a short script instead of pulling whole tables': 'Code-Mode-Beispiel: Ein Agent schreibt ein kurzes Skript, statt ganze Tabellen abzurufen',
  'Close experiment': 'Experiment schließen',
  'Close quick navigation': 'Schnellnavigation schließen',
  'Search sections and experiments': 'Abschnitte und Experimente durchsuchen',
  'Try games, AI, backend…': 'Zum Beispiel Spiele, KI, Backend …',
  'Results': 'Ergebnisse'
};

const TITLE = { en: 'Siddharth Agarwal · Engineer & personal lab', de: 'Siddharth Agarwal · Entwickler & persönliches Labor' };
const ATTRS = ['aria-label', 'placeholder'];
const normalize = s => s.replace(/\s+/g, ' ').trim();
let originals = null;

// Remember the English text once, then swap it in and out.
function collect() {
  const text = [], attrs = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('#lab-content, #command-results, script')) continue;
    const html = normalize(el.innerHTML);
    if (html in PAGE_DE) text.push({ el, html });
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      if (value && value in ATTR_DE) attrs.push({ el, name, value });
    }
  }
  return { text, attrs };
}

export function applyPage() {
  originals ??= collect();
  const de = lang === 'de';
  for (const { el, html } of originals.text) el.innerHTML = de ? PAGE_DE[html] : html;
  for (const { el, name, value } of originals.attrs) el.setAttribute(name, de ? ATTR_DE[value] : value);
  document.documentElement.lang = lang;
  document.title = TITLE[lang];
  const toggle = document.getElementById('lang-toggle');
  if (toggle) {
    toggle.textContent = de ? 'EN' : 'DE';
    toggle.lang = de ? 'en' : 'de';
    toggle.setAttribute('aria-label', de ? 'Read in English' : 'Auf Deutsch lesen');
    toggle.title = toggle.getAttribute('aria-label');
  }
}

// For checking coverage during development: English text left on the page in German mode.
export function untranslated() {
  return originals ? originals.text.filter(({ html }) => !PAGE_DE[html]).map(x => x.html) : [];
}
