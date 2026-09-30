// Reference facts for /guide (generic, not tied to one trip). The personal day plan lives in the KV trip data.
// Facts come from the Sept 2026 research; prices carry the year of their source.

// Reference data for /guide.
export const CITIES = [
  {
    id: "tashkent", name: "Tashkent",
    tickets: [["Moyi Mubarek (Hazrati Imam)", "40k", "09:00–16:00"], ["Kukeldash Madrasah", "15k", ""], ["Chorsu Bazaar", "free", "05:00–20:00"], ["Metro ride", "3k", "QR or bank card"]],
    food: [["Besh Qozon (Central Asian Plov Centre)", "Plov from giant kazans, 09:00–23:00", false]],
    watch: ["Airport taxi touts: order in Yandex Go.", "Central station has no ATM."],
  },
  {
    id: "samarkand", name: "Samarkand",
    tickets: [["Registan", "100k", "08:00–23:00"], ["Shah-i-Zinda", "80k", "07:00–22:00"], ["Gur-e-Amir", "75k", "09:00–19:00"], ["Bibi-Khanym", "75k", "09:00–20:00"],
      ["Ulugbek Observatory", "75k", ""], ["Registan light show", "150k (2026)", "20:00, 25 min"]],
    food: [["Joni Osh", "Plov, opens 11:00, sold out by ~14:00", false], ["Emirhan", "Rooftop over Registan", true], ["Platan", "Dinner", true],
      ["Samarqand Osh Markazi N1", "Half plov 40–70k (2024)", false], ["Kokandskaya Somsa", "Somsa ~7k", false]],
    watch: ["Unlicensed guides at Registan charge high fees: use a licensed guide (single source).", "Restaurant hours are short."],
  },
  {
    id: "bukhara", name: "Bukhara",
    tickets: [["The Ark", "60k", "09:00–18:00"], ["Kalyan Mosque", "20k", ""], ["Magoki-Attari", "20k", ""], ["Ulugbek / Abdulaziz madrasas", "20k each", ""],
      ["Sitorai Mohi-Hosa", "60k", ""], ["Po-i-Kalyan, Lyabi-Hauz, trading domes", "free", ""]],
    food: [["Ayvan", "Terrace over Lyabi-Hauz", true], ["Joy Chaikhana", "Dinner", true], ["Old Bukhara", "Terrace", false], ["The Plov", "Plov", false],
      ["Silk Road Tea House", "Tea and sweets ~70k", false]],
    watch: ["Station is in Kagan, 15 km out: taxi ~100k (2025). Buses stop about 18:00.", "Taxis often overcharge: use Yandex Go.",
      "Many “tourist offices” are only shops.", "Free-tea carpet sales (single source)."],
  },
  {
    id: "khiva", name: "Khiva",
    tickets: [["Itchan Kala combined ticket", "250k", "West Gate only; 24 h–2 days"], ["Islam Khoja minaret", "100k", "not in ticket"],
      ["Pahlavan Mahmud", "25–30k", "not in ticket"], ["City walls", "40k", "not in ticket"], ["Kuhna Ark watchtower", "20–100k", "not in ticket"]],
    food: [["Terrassa", "Book days ahead by WhatsApp", true], ["Arxi Terrasa", "Sunset about 19:30–20:00", false], ["Mirza Boshi", "Shivit oshi", false],
      ["Aim Coffee", "Coffee", false], ["ATA Gamburg", "Casual", false]],
    watch: ["Skip Bir Gumbaz (single source).", "Main sights are busiest when day-trippers arrive: go early or late."],
  },
];

export const REFERENCE = {
  money: [
    "Use Kapitalbank or Ipak Yo'li ATMs (Visa, Mastercard): fee about 1.5%, sometimes plus 30k UZS; 2–4 million UZS per withdrawal.",
    "Airport and station ATMs are often broken, and many print no receipt.",
    "Cards now work at most museums and restaurants (Registan and Gur-e-Amir take cards), but bazaars, small food stalls and some sights want cash. Terminals may add about 1.5%.",
    "Check the bill before you tip: service is often already included.",
  ],
  connectivity: [
    "Install Yandex Go before you go. You need a local SIM or eSIM for it. The Start tariff is 3,700 UZS plus 900 UZS/km (Mar 2026).",
    "SIM in the arrivals hall: Beeline, Ucell, Mobiuz or Uzmobile, about 50–60k UZS (2026). Bring your passport.",
    "Hotel Wi-Fi is often poor: rely on mobile data.",
    "Taxis often have no working rear seatbelts.",
  ],
  documents: [
    "Every hotel registers you (eMehmon) and should give you a slip. Keep every slip: officers can ask for them at exit.",
    "Avoid gaps between registered stays. Keep night-train tickets as proof for those nights.",
    "Keep passports and train tickets handy: stations check both before security.",
  ],
  etiquette: [
    "Cover shoulders and knees. Women need a headscarf in active mosques. Slip-on shoes help.",
    "Tear bread by hand; do not cut it or place it upside down.",
    "Put your hand over the cup to refuse more tea.",
    "Avoid mosques at Friday midday prayers. Ask before you photograph people.",
  ],
  weather: "October: Samarkand about 18–23 °C by day and 9–14 °C at night; Khiva about 22 °C by day and 8 °C at night. Very little rain. Pack a warm layer for evenings and the night train.",
  emergency: [["General emergency", "112"], ["Police", "102"], ["Ambulance", "103"], ["Fire", "101"], ["Tourist hotline", "1173"]],
  phrases: [
    ["Hello", "Assalomu alaykum", "Здравствуйте (zdravstvuyte)"], ["Thank you", "Rahmat", "Спасибо (spasibo)"],
    ["How much?", "Qancha?", "Сколько стоит? (skolko stoit)"], ["The bill, please", "Hisob, iltimos", "Счёт, пожалуйста (schyot, pozhaluysta)"],
    ["No, thank you", "Yo'q, rahmat", "Нет, спасибо (net, spasibo)"], ["Where is…?", "… qayerda?", "Где…? (gde)"],
    ["Train station", "Vokzal", "Вокзал (vokzal)"], ["Delicious", "Mazali", "Вкусно (vkusno)"],
  ],
};

export const SOURCES = [
  ["Wikivoyage: Tashkent, Samarkand, Bukhara, Khiva (2025–26)", "https://en.wikivoyage.org/wiki/Samarkand"],
  ["Silk Road Tour: entrance tickets and prices", "https://silkroad-tour.com/entrance-tickets-and-prices-in-uzbekistan/"],
  ["Wander-Lush: Samarkand, Bukhara, Khiva itineraries", "https://wander-lush.org/khiva-itinerary/"],
  ["Seat61: trains in Uzbekistan", "https://www.seat61.com/Uzbekistan.htm"],
  ["Caravanistan forum: money and ATMs (2024)", "https://caravanistan.com/forum/viewtopic.php?t=9587&start=50"],
  ["Megan Starr: Tashkent airport; Khiva restaurants", "https://www.meganstarr.com/khiva-restaurants-cafes/"],
  ["Eva Darling: Samarkand restaurants", "https://www.eva-darling.com/restaurants-in-samarkand/"],
  ["Wanderboo: Bukhara food guide", "https://wanderboo.com/bukhara-food-guide-best-restaurants-you-must-try/"],
  ["Uz-Safar: Registan light show 2026", "https://www.uz-safar.com/blog/registan-sound-and-light-show-samarkand-2026-guide"],
  ["Voyage.uz: Yandex Go; visa registration", "https://voyage.uz/guides/transport-yandex-go/"],
  ["Tourfixer: night trains; Tashkent–Khiva transport (2026)", "https://tourfixer.uz/en/blog/tashkent-to-khiva-transport-guide"],
  ["Adventurous Kate: what not to do in Uzbekistan", "https://www.adventurouskate.com/what-not-to-do-in-uzbekistan/"],
  ["Rough Guides: Uzbekistan in October", "https://www.roughguides.com/uzbekistan/when-to-go/october/"],
];
