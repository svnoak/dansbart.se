import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { service } from "@ember/service";
import avatar from "discourse/helpers/avatar";
import icon from "discourse/helpers/d-icon";
import DiscourseURL from "discourse/lib/url";
import { i18n } from "discourse-i18n";

/**
 * The "Skriv något till gruppen…" box at the top of a topic list, like the
 * "Write something…" box at the top of a Facebook group. One tap opens the
 * composer for a new topic in the category or tag the person is looking at.
 */
export default class DansbartComposerPrompt extends Component {
  @service composer;
  @service currentUser;

  get category() {
    return this.args.outletArgs?.category;
  }

  get tag() {
    return this.args.outletArgs?.tag;
  }

  get shouldRender() {
    if (!this.currentUser) {
      return true;
    }
    if (this.category && !this.category.canCreateTopic) {
      return false;
    }
    return this.currentUser.can_create_topic !== false;
  }

  get promptText() {
    return this.currentUser
      ? settings.composer_prompt_text
      : i18n(themePrefix("dansbart.composer_prompt_login"));
  }

  @action
  open() {
    if (!this.currentUser) {
      DiscourseURL.routeTo("/login");
      return;
    }
    this.composer.openNewTopic({
      category: this.category,
      tags: this.tag?.id ? [this.tag.id] : undefined,
    });
  }

  <template>
    {{#if this.shouldRender}}
      <div class="dansbart-composer-prompt">
        {{#if this.currentUser}}
          <span class="dansbart-composer-prompt__avatar">
            {{avatar this.currentUser imageSize="medium"}}
          </span>
        {{/if}}
        <button
          type="button"
          class="dansbart-composer-prompt__button"
          aria-label={{i18n (themePrefix "dansbart.composer_prompt_aria")}}
          {{on "click" this.open}}
        >
          {{icon "pencil"}}
          <span
            class="dansbart-composer-prompt__text"
          >{{this.promptText}}</span>
        </button>
      </div>
    {{/if}}
  </template>
}
