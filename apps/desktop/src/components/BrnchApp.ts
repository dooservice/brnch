import { LitElement, css, html } from "lit";

import { TauriProjectBackend } from "../backend/TauriProjectBackend";
import { ProjectSwitcherState } from "../state/ProjectSwitcherState";
import "./BrnchProjectSwitcher";

/** The window: projects on the left, the active project's workspaces on the right. */
export class BrnchApp extends LitElement {
  static override styles = css`
    :host { display: grid; grid-template-columns: 260px 1fr; height: 100vh;
      font-family: system-ui, sans-serif; background: #15161c; color: #e6e6ec; }
    aside { border-right: 1px solid #2a2d3a; overflow: auto; }
    main { padding: 16px; overflow: auto; }
    code { color: #9db7ff; }
  `;

  private readonly state = new ProjectSwitcherState(new TauriProjectBackend());
  private stopListening: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopListening = this.state.subscribe(() => this.requestUpdate());
    void this.state.load();
  }

  override disconnectedCallback(): void {
    this.stopListening?.();
    super.disconnectedCallback();
  }

  override render() {
    return html`
      <aside><brnch-project-switcher .state=${this.state}></brnch-project-switcher></aside>
      <main>
        ${this.state.activeProjectIdentifier === null
          ? html`<p>Add a project to start.</p>`
          : html`<h2>Workspaces</h2>
              <ul>
                ${this.state.workspaces.map(
                  (workspace) =>
                    html`<li><code>${workspace.branchName}</code> ${workspace.directory}</li>`,
                )}
              </ul>`}
      </main>
    `;
  }
}

customElements.define("brnch-app", BrnchApp);
