// Minimal i18n: a flat key -> {lang: text} dictionary and a t(key) helper
// bound to whatever language is active for the current request. Add more
// languages by adding another column below — no build step needed.
const STRINGS = {
  browse_ads: { en: 'Browse Ads', fr: 'Voir les annonces', pt: 'Ver anúncios', sw: 'Tazama Matangazo', sn: 'Ona Zvichengeti' },
  post_free_ad: { en: '+ Post Free Ad', fr: '+ Publier une annonce', pt: '+ Publicar anúncio', sw: '+ Weka Tangazo', sn: '+ Isa Chiziviso' },
  log_in: { en: 'Log In', fr: 'Connexion', pt: 'Entrar', sw: 'Ingia', sn: 'Pinda' },
  search_placeholder: { en: 'Search ads (e.g. Toyota, iPhone, plot)', fr: 'Rechercher (ex. Toyota, iPhone, terrain)', pt: 'Pesquisar (ex. Toyota, iPhone, terreno)', sw: 'Tafuta matangazo (mf. Toyota, iPhone, kiwanja)', sn: 'Tsvaga zvichengeti' },
  all_categories: { en: 'All Categories', fr: 'Toutes catégories', pt: 'Todas categorias', sw: 'Kategoria Zote', sn: 'Zvese Zvikamu' },
  all_countries: { en: 'All Countries', fr: 'Tous les pays', pt: 'Todos os países', sw: 'Nchi Zote', sn: 'Nyika Dzese' },
  search: { en: 'Search', fr: 'Rechercher', pt: 'Pesquisar', sw: 'Tafuta', sn: 'Tsvaga' },
  chat_on_whatsapp: { en: 'Chat on WhatsApp', fr: 'Discuter sur WhatsApp', pt: 'Conversar no WhatsApp', sw: 'Ongea WhatsApp', sn: 'Taura neWhatsApp' },
  post_ad_title: { en: 'Post a Free Ad', fr: 'Publier une annonce gratuite', pt: 'Publicar um anúncio gratuito', sw: 'Weka Tangazo Bila Malipo', sn: 'Isa Chiziviso Pasina Mari' },
};

const SUPPORTED = ['en', 'fr', 'pt', 'sw', 'sn'];
const LANG_NAMES = { en: 'English', fr: 'Français', pt: 'Português', sw: 'Kiswahili', sn: 'chiShona' };

function makeT(lang) {
  const l = SUPPORTED.includes(lang) ? lang : 'en';
  return function t(key) {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[l] || entry.en || key;
  };
}

module.exports = { SUPPORTED, LANG_NAMES, makeT };
