import { useState } from "react";
import { Plus, Users, Trash2, Search } from "lucide-react";
import { useLocal } from "../storage";
import { Dialog } from "../Dialog";
type Participant = {
  id: string;
  name: string;
  email: string;
  teamCode: string;
  checkedIn: boolean;
};
export function Participants() {
  const [people, setPeople] = useLocal<Participant[]>("gj-participants", []);
  const [teams] = useLocal<{ code: string; name: string }[]>("gj-teams", []);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  return (
    <section className="panel participants-panel">
      <div className="section-heading">
        <div>
          <h3>
            <Users size={18} />
            Registro de participantes
          </h3>
          <p>
            {people.length} / 100 registrados ·{" "}
            {people.filter((p) => p.checkedIn).length} con entrada confirmada
          </p>
        </div>
        <button
          className="button primary"
          disabled={people.length >= 100}
          onClick={() => {
            setError("");
            setShow(true);
          }}
        >
          <Plus size={15} />
          Participante
        </button>
      </div>
      <div className="search-field participant-search">
        <Search size={16} />
        <input
          placeholder="Buscar participante..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              <th>Correo</th>
              <th>Equipo</th>
              <th>Entrada</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people
              .filter((p) =>
                (p.name + " " + p.email)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.email || "Sin correo"}</td>
                  <td>
                    {teams.find((t) => t.code === p.teamCode)?.name ||
                      "Sin equipo"}
                  </td>
                  <td>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={p.checkedIn}
                        onChange={(e) =>
                          setPeople(
                            people.map((x) =>
                              x.id === p.id
                                ? { ...x, checkedIn: e.target.checked }
                                : x,
                            ),
                          )
                        }
                      />
                      Confirmada
                    </label>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Eliminar a ${p.name}`}
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${p.name} del registro?`))
                          setPeople(people.filter((x) => x.id !== p.id));
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!people.length && (
          <p className="empty">
            Registra a tus participantes. No necesitan una cuenta para asistir.
          </p>
        )}
      </div>
      {show && (
        <Dialog onClose={() => setShow(false)}>
          <h3>Nuevo participante</h3>
          {error && (
            <p className="cloud-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="cloud-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name") || "").trim();
              const email = String(f.get("email") || "")
                .trim()
                .toLowerCase();
              if (people.length >= 100) {
                setError("Se alcanzó el límite de 100 participantes");
                return;
              }
              if (email && people.some((p) => p.email === email)) {
                setError("Este correo ya está registrado");
                return;
              }
              setPeople([
                ...people,
                {
                  id: crypto.randomUUID(),
                  name,
                  email,
                  teamCode: String(f.get("team") || ""),
                  checkedIn: false,
                },
              ]);
              setShow(false);
            }}
          >
            <label>
              Nombre completo
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Correo (opcional)
              <input name="email" type="email" maxLength={254} />
            </label>
            <label>
              Equipo
              <select name="team">
                <option value="">Sin equipo</option>
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit">
              Registrar participante
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
