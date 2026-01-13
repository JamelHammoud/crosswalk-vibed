import { generateUsername as generate } from "unique-username-generator";

export function generateUsername(): string {
  return generate("-", 0, 15);
}

export function generateUsernameStyled(): string {
  const styles = ["capital", "lowerCase"] as const;
  const style = styles[Math.floor(Math.random() * styles.length)];
  const separators = ["", "-", "_"];
  const separator = separators[Math.floor(Math.random() * separators.length)];

  return generate(separator, 0, 15);
}
