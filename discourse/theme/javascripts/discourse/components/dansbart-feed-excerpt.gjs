import Component from "@glimmer/component";
import { htmlSafe } from "@ember/template";
import { i18n } from "discourse-i18n";

/**
 * The first lines of a topic under its title in the feed. Discourse only
 * sends excerpts for every topic when the site setting
 * "always include topic excerpts" is on; without it only pinned topics have
 * one and this component renders nothing for the rest. Pinned topics that
 * Discourse already expands are skipped so the excerpt is not shown twice.
 */
export default class DansbartFeedExcerpt extends Component {
  get topic() {
    return this.args.outletArgs?.topic;
  }

  get shouldRender() {
    return this.topic?.hasExcerpt && !this.args.outletArgs?.expandPinned;
  }

  get excerpt() {
    return htmlSafe(this.topic.excerpt);
  }

  <template>
    {{#if this.shouldRender}}
      <a class="dansbart-feed-excerpt" href={{this.topic.url}}>
        {{this.excerpt}}
        {{#if this.topic.excerptTruncated}}
          <span class="dansbart-feed-excerpt__more">
            {{i18n (themePrefix "dansbart.excerpt_read_more")}}
          </span>
        {{/if}}
      </a>
    {{/if}}
  </template>
}
