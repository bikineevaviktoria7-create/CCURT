import { settingsService, useSettings } from "../../services/settingsService";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/** Feedback preferences. Visual feedback is always on; the rest are optional. */
export function SettingsPanel() {
  const settings = useSettings();
  const toggle = (key: "soundEnabled" | "speechEnabled", label: string) => (
    <label className="setting-toggle">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(event) => settingsService.update({ [key]: event.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <details className="settings-panel card">
      <summary><SlidersHorizontal size={18} aria-hidden="true" /><span>Настройки обучения</span><ChevronDown size={17} className="settings-chevron" aria-hidden="true" /></summary>
      <div className="settings-grid">
        <fieldset>
          <legend>Какой рукой показываете жесты?</legend>
          {(["right", "left"] as const).map((hand) => (
            <label className="setting-toggle" key={hand}>
              <input
                type="radio"
                name="dominant-hand"
                checked={settings.dominantHand === hand}
                onChange={() => settingsService.update({ dominantHand: hand })}
              />
              {hand === "right" ? "Правой" : "Левой"}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Дополнительная обратная связь</legend>
          {toggle("soundEnabled", "Звуки успеха и подсказок")}
          {toggle("speechEnabled", "Озвучивать распознанное слово")}
        </fieldset>
      </div>
    </details>
  );
}
