/**
 * Dark theme, generated from the light one.
 *
 * Runs after Tailwind. For every rule that sets a colour, it adds a dark copy of that rule which applies when
 * the phone is in dark mode (unless the person picked Light in Profile → Appearance) or when they picked Dark.
 * Colours are mapped by the role they play, because the same colour does different jobs: brand-950 is the dark
 * green header background and also the heading text on white cards. So backgrounds, text and borders each have
 * their own table, and anything not in a table (green headers, gold buttons, white text) stays as it is.
 *
 * Gold and other light backgrounds stay light in dark mode, so the text on them must stay dark. Mapped text
 * colours read a CSS variable first (--cv-ink-<hex>); those light backgrounds set it back to the original
 * colour, and everything inside them inherits it.
 *
 * Printing always uses the light design.
 */

const BG = {
  "#ffffff": "#13241c", // cards (only when opaque; white/10 overlays on green stay as they are)
  "#f6f4ee": "#0c1a14", // cream: the page
  "#efece3": "#10211a", // cream-100
  "#fafaf9": "#172a21", // stone-50
  "#f5f5f4": "#1b3027", // stone-100
  "#e7e5e4": "#24392f", // stone-200
  "#d6d3d1": "#2f463a", // stone-300
  "#eef5f1": "#163126", // brand-50
  "#d9eae1": "#1c3a2d", // brand-100
  "#b3d4c3": "#24493a", // brand-200
  "#7fb59b": "#2f5c49", // brand-300
  "#fbf6ea": "#2a2415", // gold-50
  "#f4e8c9": "#3a3019", // gold-100
  "#fdf0ef": "#2e1715", // maroon-50
  "#f9d7d4": "#3d1d1a", // maroon-100
  "#f0f9ff": "#10233a", // sky-50
  "#fffbeb": "#2c2312", // amber-50
};

const TEXT = {
  "#1c1917": "#eef3ef", // stone-900
  "#292524": "#e6ece8", // stone-800
  "#44403c": "#cdd8d1", // stone-700
  "#57534e": "#b3c2b9", // stone-600
  "#78716c": "#97a99e", // stone-500
  "#a8a29e": "#7a8c82", // stone-400
  "#d6d3d1": "#5c6f65", // stone-300
  "#09251b": "#ecf5ef", // brand-950
  "#0e3628": "#e3efe8", // brand-900
  "#124331": "#cfe6da", // brand-800
  "#17523b": "#8fd0b0", // brand-700
  "#1d6146": "#7fc4a2", // brand-600
  "#865f24": "#e2c477", // gold-700
  "#a87b2c": "#ddbb66", // gold-600
  "#86231b": "#f4a196", // maroon-700
  "#a92d23": "#f08a7e", // maroon-600
  "#c2372b": "#f39b90", // maroon-500
  "#0369a1": "#8cc4f0", // sky-700
  "#075985": "#a3d1f5", // sky-800
  "#b45309": "#e8c06a", // amber-700
  "#92400e": "#efcd80", // amber-800
  "#9ca3af": "#7a8c82", // Tailwind's default placeholder colour
};

const BORDER = {
  "#ffffff": "#24392f", // white borders (opaque only)
  "#f5f5f4": "#1f3329", // stone-100
  "#e7e5e4": "#2a4035", // stone-200
  "#d6d3d1": "#3a5246", // stone-300
  "#d9eae1": "#22473a", // brand-100
  "#b3d4c3": "#2d5a47", // brand-200
  "#7fb59b": "#3f7560", // brand-300
  "#e9d397": "#5a4a22", // gold-200
  "#f9d7d4": "#5a2a24", // maroon-100
  "#f4e8c9": "#3a3019", // gold-100 (rings)
  "#f0eee9": "#1f3329", // phone table rows (globals.css)
  "#e5e7eb": "#24392f", // Tailwind's default border colour (a plain "border" with no colour class)
};

const ROLE = {
  "background-color": "bg", background: "bg",
  "--tw-gradient-from": "bg", "--tw-gradient-to": "bg", "--tw-gradient-via": "bg",
  color: "text", fill: "text", stroke: "text", "caret-color": "text", "text-decoration-color": "text",
  "-webkit-text-fill-color": "text",
  "border-color": "border", border: "border", "border-top": "border", "border-right": "border",
  "border-bottom": "border", "border-left": "border", outline: "border", "border-top-color": "border", "border-right-color": "border",
  "border-bottom-color": "border", "border-left-color": "border", "border-x-color": "border", "border-y-color": "border",
  "outline-color": "border", "--tw-ring-color": "border", "--tw-ring-offset-color": "border",
};
const TABLE = { bg: BG, text: TEXT, border: BORDER };

const LIGHT = ':root:not([data-theme="light"])';
const DARK = ':root[data-theme="dark"]';

const hex2 = (n) => n.toString(16).padStart(2, "0");
const toHex = (r, g, b) => `#${hex2(+r)}${hex2(+g)}${hex2(+b)}`;
const triplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const expand3 = (h) => (h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h).toLowerCase();

// Finds the colours in a declaration value: rgb(r g b), rgb(r g b / alpha) (alpha may hold var(...)), #rgb, #rrggbb.
function findColours(value) {
  const out = [];
  let i = 0;
  while (i < value.length) {
    if (value.startsWith("rgb(", i)) {
      let depth = 0, j = i + 3;
      for (; j < value.length; j++) {
        if (value[j] === "(") depth++;
        else if (value[j] === ")" && --depth === 0) break;
      }
      const inner = value.slice(i + 4, j);
      const m = inner.match(/^\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*(?:\/\s*(.+))?$/s);
      if (m) out.push({ start: i, end: j + 1, hex: toHex(m[1], m[2], m[3]), alpha: m[4] ? m[4].trim() : null });
      i = j + 1;
    } else if (value[i] === "#") {
      const m = value.slice(i).match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
      if (m) { out.push({ start: i, end: i + m[0].length, hex: expand3(m[0]), alpha: null }); i += m[0].length; }
      else i++;
    } else i++;
  }
  return out;
}
const isOpaque = (alpha) => alpha == null || /^var\(--tw-[a-z-]+opacity,\s*1\)$/.test(alpha) || alpha === "1";
// How see-through a colour is: 1 for solid (including Tailwind's opacity variable), else the number given.
const alphaOf = (alpha) => { if (isOpaque(alpha)) return 1; const n = parseFloat(alpha); return Number.isNaN(n) ? 1 : n; };

function mapValue(prop, value) {
  const role = ROLE[prop];
  if (!role) return null;
  const table = TABLE[role];
  const found = findColours(value);
  // No colour to map (transparent, currentColor, inherit, a variable): still copy it, so it keeps winning over
  // dark defaults the way it does in light mode (e.g. border-transparent against the default border colour).
  if (!found.length) return { value, lightBg: null };
  let changed = false, lightBg = null, result = "", last = 0;
  for (const c of found) {
    let dark = table[c.hex];
    // Faint white (under 50%) is a highlight on green headers or photos: leave it alone. Mostly-white
    // (bg-white/70, /90, /95) is a surface - sticky bars, empty states, buttons over photos - so it turns dark too.
    if (dark && c.hex === "#ffffff" && (role === "border" ? !isOpaque(c.alpha) : alphaOf(c.alpha) < 0.5)) dark = null;
    // Gradient end stops are the same colour at 0 opacity.
    if (dark && c.alpha === "0" && role === "bg") dark = table[c.hex];
    let rep = value.slice(c.start, c.end);
    if (dark) {
      changed = true;
      const a = c.alpha ? ` / ${c.alpha}` : "";
      rep = role === "text"
        ? `rgb(var(--cv-ink-${c.hex.slice(1)}, ${triplet(dark)})${a})`
        : `rgb(${triplet(dark)}${a})`;
    } else if (role === "bg" && prop === "background-color" && luminance(c.hex) > 0.35 &&
      (isOpaque(c.alpha) || parseFloat(c.alpha) >= 0.7)) {
      // Stays light (gold buttons, yellow badges, mostly-white buttons on photos): keep dark text on it.
      lightBg = true;
    }
    result += value.slice(last, c.start) + rep;
    last = c.end;
  }
  result += value.slice(last);
  // Unchanged colours are copied too: dark rules weigh more than light ones, so every colour rule needs its dark
  // twin, or a light hover colour (say hover:bg-brand-800) would lose to a dark card colour on the same element.
  return { value: changed ? result : value, lightBg };
}

const INK_RESET = Object.keys(TEXT).map((hex) => [`--cv-ink-${hex.slice(1)}`, triplet(hex)]);

function insideSkipped(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && (/keyframes$/.test(p.name) || (p.name === "media" && /\bprint\b/.test(p.params)))) return true;
  }
  return false;
}

// Anything inside an element with class "cv-light" keeps the light design (receipts are paper). The dark rules
// skip those elements; the :not() goes before any pseudo-element (::placeholder, ::before), where it must sit.
const NOT_LIGHT = ":not(.cv-light, .cv-light *)";
function island(s) {
  const at = s.indexOf("::");
  return at === -1 ? s + NOT_LIGHT : s.slice(0, at) + NOT_LIGHT + s.slice(at);
}
// Splits a selector list on its top-level commas only (Tailwind writes :where(a, b) inside some selectors).
function splitList(selector) {
  const out = []; let depth = 0, cur = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}
function prefix(selector, root) {
  return splitList(selector).map((s) => s.trim()).filter((s) => !/^(html|:root)\b/.test(s)).map((s) => `${root} ${island(s)}`).join(", ");
}

module.exports = () => ({
  postcssPlugin: "casavilla-dark",
  OnceExit(root, { AtRule, Rule }) {
    const jobs = [];
    root.walkRules((rule) => {
      if (insideSkipped(rule) || rule.selector.includes(LIGHT) || rule.selector.includes(DARK)) return;
      const decls = [];
      let lightBg = false;
      rule.each((d) => {
        if (d.type !== "decl") return;
        const m = mapValue(d.prop, d.value);
        if (!m) return;
        decls.push({ prop: d.prop, value: m.value, important: d.important });
        if (m.lightBg) lightBg = true;
      });
      if (!decls.length && !lightBg) return;
      if (lightBg) for (const [prop, value] of INK_RESET) decls.push({ prop, value });
      jobs.push({ rule, decls });
    });
    for (const { rule, decls } of jobs) {
      const auto = prefix(rule.selector, LIGHT);
      const forced = prefix(rule.selector, DARK);
      if (!auto) continue;
      const media = new AtRule({ name: "media", params: "screen and (prefers-color-scheme: dark)" });
      const a = new Rule({ selector: auto });
      const screen = new AtRule({ name: "media", params: "screen" });
      const f = new Rule({ selector: forced });
      for (const d of decls) { a.append({ ...d }); f.append({ ...d }); }
      media.append(a);
      screen.append(f);
      rule.after(screen);
      rule.after(media);
    }
  },
});
module.exports.postcss = true;
