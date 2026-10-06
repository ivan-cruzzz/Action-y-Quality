import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./ru";
import en from "./en";

const saved = (() => {
  try {
    return localStorage.getItem("aq.locale");
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: saved === "en" ? "en" : "ru",
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

export default i18n;
