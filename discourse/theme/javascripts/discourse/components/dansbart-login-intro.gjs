import Component from "@glimmer/component";
import { service } from "@ember/service";
import icon from "discourse/helpers/d-icon";
import { i18n } from "discourse-i18n";

/**
 * The top of the login and create-account pages: the dansbart mark, a
 * heading that names Google as the way in, and one line of reassurance.
 * The theme's stylesheet hides the core welcome header and moves the
 * Google button directly under this intro.
 */
export default class DansbartLoginIntro extends Component {
  @service router;

  get isSignup() {
    return this.router.currentRouteName === "signup";
  }

  get heading() {
    return this.isSignup ? settings.signup_heading : settings.login_heading;
  }

  get blurb() {
    return this.isSignup ? settings.signup_blurb : settings.login_blurb;
  }

  <template>
    <div class="dansbart-login-intro">
      <span class="dansbart-logo-mark" aria-hidden="true">D</span>
      <h1 class="dansbart-login-intro__heading">{{this.heading}}</h1>
      {{#if this.blurb}}
        <p class="dansbart-login-intro__blurb">{{this.blurb}}</p>
      {{/if}}
      <a class="dansbart-login-intro__back" href={{settings.main_site_url}}>
        {{icon "arrow-left"}}
        {{i18n (themePrefix "dansbart.login_back")}}
      </a>
    </div>
  </template>
}
