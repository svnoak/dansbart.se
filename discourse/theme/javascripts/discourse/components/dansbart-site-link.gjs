import Component from "@glimmer/component";
import icon from "discourse/helpers/d-icon";

/**
 * A header link back to dansbart.se, so a person who came from the music
 * site can get back the same way they arrived.
 */
export default class DansbartSiteLink extends Component {
  <template>
    <li class="header-dropdown-toggle dansbart-site-link">
      <a
        class="icon btn-flat dansbart-site-link__anchor"
        href={{settings.main_site_url}}
        title={{settings.main_site_label}}
      >
        {{icon "music"}}
        <span
          class="dansbart-site-link__label"
        >{{settings.main_site_label}}</span>
      </a>
    </li>
  </template>
}
