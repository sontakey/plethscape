import { useId } from "react";
import { useTheme, type Theme } from "./theme";

export default function AppearanceSelect({
  className = "",
}: {
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const id = useId();
  return (
    <label className={`appearance-control ${className}`} htmlFor={id}>
      <span>Appearance</span>
      <select
        id={id}
        aria-label="Appearance"
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
