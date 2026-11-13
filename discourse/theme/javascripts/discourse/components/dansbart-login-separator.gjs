import { i18n } from "discourse-i18n";

/**
 * The "eller logga in med e-post" line between the Google button and the
 * email form. It renders inside the login buttons on both the login and the
 * create-account page; the stylesheet shows the right wording for each page
 * and hides the line entirely when there is no email form under it.
 */
const DansbartLoginSeparator = <template>
  <div class="dansbart-login-separator" aria-hidden="true">
    <span class="dansbart-login-separator__login">
      {{i18n (themePrefix "dansbart.login_or_email")}}
    </span>
    <span class="dansbart-login-separator__signup">
      {{i18n (themePrefix "dansbart.signup_or_email")}}
    </span>
  </div>
</template>;

export default DansbartLoginSeparator;
