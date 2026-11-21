import Component from "@glimmer/component";
import ageWithTooltip from "discourse/helpers/age-with-tooltip";
import avatar from "discourse/helpers/avatar";
import getURL from "discourse/lib/get-url";
import { prioritizeNameInUx } from "discourse/lib/settings";
import { formatUsername } from "discourse/lib/utilities";

/**
 * The line above a topic title in the feed: who started it and when, the way
 * a post in a Facebook group leads with its author. The first poster in a
 * topic list is always the person who started the topic.
 */
export default class DansbartFeedAuthor extends Component {
  get topic() {
    return this.args.outletArgs?.topic;
  }

  get user() {
    return this.topic?.posters?.[0]?.user;
  }

  get displayName() {
    const user = this.user;
    return prioritizeNameInUx(user.name)
      ? user.name
      : formatUsername(user.username);
  }

  get profileUrl() {
    return getURL(`/u/${this.user.username}`);
  }

  <template>
    {{#if this.user}}
      <div class="dansbart-feed-author">
        <a
          class="dansbart-feed-author__avatar"
          href={{this.profileUrl}}
          data-user-card={{this.user.username}}
        >
          {{avatar this.user imageSize="medium"}}
        </a>
        <span class="dansbart-feed-author__meta">
          <a
            class="dansbart-feed-author__name"
            href={{this.profileUrl}}
            data-user-card={{this.user.username}}
          >{{this.displayName}}</a>
          <span class="dansbart-feed-author__time">
            {{ageWithTooltip this.topic.created_at}}
          </span>
        </span>
      </div>
    {{/if}}
  </template>
}
