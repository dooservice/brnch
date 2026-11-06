import { LitElement, css, html } from "lit";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

/** The list of projects on the side. One click makes a project the active one. */
export class BrnchProjectSwitcher extends LitElement {
  static override properties = { state: { attribute: false } };

  static override styles = css`
    :host { display: block; }
    ul { list-style: none; margin: 0; padding: 0; }
    button.project { width: 100%; text-align: left; padding: 8px 12px; border: 0;
      background: transparent; color: inherit; cursor: pointer; font: inherit; }
    button.project[aria-current="true"] { background: var(--brnch-selected, #2a2d3a); }
    form { display: grid; gap: 4px; padding: 12px; }
    input { font: inherit; padding: 4px 6px; }
  `;

  state!: ProjectSwitcherState;

  override render() {
    return html`
      <ul>
        ${this.state.projects.map(
          (project) => html`<li>
            <button
              class="project"
              aria-current=${String(project.identifier === this.state.activeProjectIdentifier)}
              @click=${() => this.state.switchTo(project.identifier)}
            >${project.name}</button>
          </li>`,
        )}
      </ul>
      <form @submit=${this.addProject}>
        <input name="name" placeholder="Project name" required />
        <input name="repositoryUrl" placeholder="Repository URL" required />
        <button type="submit">Add project</button>
      </form>
    `;
  }

  private async addProject(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    await this.state.addProject(String(data.get("name")), String(data.get("repositoryUrl")));
    form.reset();
  }
}

customElements.define("brnch-project-switcher", BrnchProjectSwitcher);
