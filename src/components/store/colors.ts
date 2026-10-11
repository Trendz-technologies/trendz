/** Swatch colours for option values named after colours (falls back to a neutral swatch). */
export const COLOR_HEX: Record<string, string> = {
  Black: "#111111", White: "#f4f4f2", Cream: "#E7DFCF", Ecru: "#E7DFCF", Navy: "#2C3A4B", Forest: "#33422F", Grey: "#8C8C88", Ink: "#1b1f24", Sage: "#7C8570",
  Berry: "#8C2B4F", Pink: "#D98FA0", Charcoal: "#3A3A3A", Maroon: "#5C1F1A", Stone: "#B8AFA0", Brown: "#6b4a35", Olive: "#6b6e45", Indigo: "#2f3d63", "Light Wash": "#9fb3c8",
  Red: "#b3261e", Teal: "#1f5f5b", Khaki: "#b7a77a", Crimson: "#8f1d2c", Rust: "#b4502b", Camel: "#c19a6b", Blue: "#3a5a8c",
};

export const isColorOption = (name: string) => ["color", "colour"].includes(name.toLowerCase());
export const swatch = (value: string) => COLOR_HEX[value] ?? "#d9d6cf";
