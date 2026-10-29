// Plain words for listings, shared by cards, page titles and links.

/** "2-bedroom apartment", "Studio", "1-bedroom house" — what people search for, in their words. */
export function homeNoun(type: string) {
  const t = type.toLowerCase();
  return t.includes("apartment") ? "apartment" : t.includes("house") ? "house" : t.includes("hostel") ? "hostel room"
    : t.includes("office") ? "office" : t.includes("commercial") || t.includes("shop") ? "shop space" : "home";
}

export function homeTitle(bedrooms: number, type: string) {
  const noun = homeNoun(type);
  if (noun === "office" || noun === "shop space") return noun[0].toUpperCase() + noun.slice(1);
  return bedrooms ? `${bedrooms}-bedroom ${noun}` : `Studio ${noun}`;
}
