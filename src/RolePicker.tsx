import { roles } from "./data";
export type Member = {
  name: string;
  email: string;
  role: string;
  roles?: string[];
  color: string;
};
export function RolePicker({
  value,
  onChange,
  label = "Roles del integrante",
  expanded = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  expanded?: boolean;
}) {
  const options = [...new Set([...roles, ...value])];
  return (
    <fieldset className="role-picker">
      <legend>{label}</legend>
      <details open={expanded}>
        <summary>
          {value.length} {value.length === 1 ? "rol" : "roles"} ·{" "}
          {value.join(" · ") || "Selecciona roles"}
        </summary>
        <p>
          Una persona puede cubrir varias responsabilidades. Selecciona al menos
          una.
        </p>
        <div className="role-checkboxes">
          {options.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={value.includes(role)}
                disabled={value.length === 1 && value.includes(role)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, role]
                      : value.filter((r) => r !== role),
                  )
                }
              />
              {role}
            </label>
          ))}
        </div>
      </details>
    </fieldset>
  );
}
