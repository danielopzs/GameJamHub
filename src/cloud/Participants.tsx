import { createId } from "../id";
import { useState } from "react";
import { useLocalEvent } from "../local/store";
import { localApi } from "../local/types";
import { Plus, Users, Trash2, Search, Download, Copy } from "lucide-react";
import { useLocal } from "../storage";
import { Dialog } from "../Dialog";
type Participant = {
  id: string;
  name: string;
  email: string;
  teamCode: string;
  checkedIn: boolean;
  ticketCode?: string;
  source?: string;
  registeredAt?: string;
};
export function Participants() {
  const local = useLocalEvent();
  const [capacity] = useLocal("gj-registration-capacity", 100);
  const limit = local ? capacity : 100;
  const [message, setMessage] = useState("");
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
            {people.length} / {limit} registrados ·{" "}
            {people.filter((p) => p.checkedIn).length} con entrada confirmada
          </p>
        </div>
        <button
          className="button primary"
          disabled={people.length >= limit}
          onClick={() => {
            setError("");
            setShow(true);
          }}
        >
          <Plus size={15} />
          Participante
        </button>
      </div>
      {local && (
        <button
          className="button secondary"
          onClick={() => {
            const quote = (v: unknown) => {
              let s = String(v ?? "");
              if (/^[=+@-]/.test(s)) s = "'" + s;
              return '"' + s.replaceAll('"', '""') + '"';
            };
            const rows = [
              ["Nombre", "Correo", "Equipo", "Check-in", "Código", "Origen"],
              ...people.map((p) => [
                p.name,
                p.email,
                p.teamCode,
                p.checkedIn ? "Confirmado" : "Pendiente",
                p.ticketCode || "",
                p.source || "Manual",
              ]),
            ];
            const url = URL.createObjectURL(
              new Blob(
                [
                  "\uFEFF" +
                    rows.map((row) => row.map(quote).join(",")).join("\r\n"),
                ],
                { type: "text/csv;charset=utf-8" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "participantes.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={15} />
          Exportar participantes
        </button>
      )}
      {message && <p role="status">{message}</p>}
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
                (p.name + " " + p.email + " " + (p.ticketCode || ""))
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {local && (
                      <small style={{ display: "block" }}>
                        {p.ticketCode || "Registro manual"}
                      </small>
                    )}
                  </td>
                  <td>{p.email || "Sin correo"}</td>
                  <td>
                    {local ? (
                      <select
                        aria-label={`Equipo de ${p.name}`}
                        value={p.teamCode}
                        onChange={(e) =>
                          setPeople(
                            people.map((person) =>
                              person.id === p.id
                                ? { ...person, teamCode: e.target.value }
                                : person,
                            ),
                          )
                        }
                      >
                        <option value="">Sin equipo</option>
                        {teams.map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      teams.find((t) => t.code === p.teamCode)?.name ||
                      "Sin equipo"
                    )}
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
                    {local && (
                      <button
                        className="icon-button"
                        aria-label={`Recuperar comprobante de ${p.name}`}
                        onClick={async () => {
                          if (
                            !confirm(
                              "Se creará un nuevo enlace personal y el anterior dejará de funcionar. ¿Continuar?",
                            )
                          )
                            return;
                          try {
                            const result = await localApi<{ token: string }>(
                              `jams/${local.jam.id}/tickets/${p.id}`,
                              { method: "POST", body: "{}" },
                            );
                            const link =
                              location.origin + "/#ticket=" + result.token;
                            try {
                              await navigator.clipboard.writeText(link);
                              setMessage(
                                "Nuevo enlace del comprobante copiado",
                              );
                            } catch {
                              setMessage("Nuevo enlace personal: " + link);
                            }
                          } catch (e) {
                            setMessage((e as Error).message);
                          }
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    )}
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
              if (people.length >= limit) {
                setError(`Se alcanzó el cupo de ${limit} participantes`);
                return;
              }
              if (email && people.some((p) => p.email === email)) {
                setError("Este correo ya está registrado");
                return;
              }
              setPeople([
                ...people,
                {
                  id: createId(),
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
