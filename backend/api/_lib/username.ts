import { generateUsername as generate } from "unique-username-generator";

export function generateUsername(): string {
  return generate("-", 0, 15);
}
