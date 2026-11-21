import { apiInitializer } from "discourse/lib/api";
import DansbartComposerPrompt from "../components/dansbart-composer-prompt";
import DansbartFeedAuthor from "../components/dansbart-feed-author";
import DansbartFeedExcerpt from "../components/dansbart-feed-excerpt";
import DansbartLoginIntro from "../components/dansbart-login-intro";
import DansbartLoginSeparator from "../components/dansbart-login-separator";
import DansbartSiteLink from "../components/dansbart-site-link";

export default apiInitializer("1.8.0", (api) => {
  // The feed layout is pure CSS, switched on by a body class so the admin
  // can turn it off from the theme settings without touching the stylesheet.
  document.body.classList.toggle("dansbart-feed", !!settings.feed_layout);

  if (settings.show_site_link_in_header) {
    api.headerIcons.add("dansbart-site-link", DansbartSiteLink, {
      before: "search",
    });
  }

  if (settings.show_composer_prompt) {
    api.renderInOutlet("before-topic-list", DansbartComposerPrompt);
  }

  if (settings.show_feed_author) {
    api.renderInOutlet("topic-list-before-link", DansbartFeedAuthor);
    api.renderInOutlet("topic-list-main-link-bottom", DansbartFeedExcerpt);
  }

  api.renderInOutlet("login-before-modal-body", DansbartLoginIntro);
  api.renderInOutlet("create-account-before-modal-body", DansbartLoginIntro);
  api.renderInOutlet("after-login-buttons", DansbartLoginSeparator);

  if (settings.show_like_labels) {
    // Every control shows a word: "Gilla" next to the heart, like the
    // "Gilla" under a post in a Facebook group.
    api.registerValueTransformer(
      "post-menu-buttons",
      ({ value, context: { buttonLabels, buttonKeys } }) => {
        buttonLabels.show(buttonKeys.LIKE);
        return value;
      },
    );
  }
});
