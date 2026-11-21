# Dansbart theme for Discourse

A Discourse theme that makes the forum look and feel like dansbart.se, and
makes the forum work a little more like a Facebook group.

What it does:

- **Design tokens from the site.** The colour schemes "Dansbart ljus" and
  "Dansbart mörk" carry the site's ink, blue and amber roles. Schibsted
  Grotesk is served from the theme. Controls get 8 px corners, cards 12 px,
  pills are fully rounded. Depth is drawn with hairlines; only floating
  layers cast a shadow.
- **A feed instead of a table.** Each topic is a card with the author's
  avatar and name on top, the title, the first lines of the post, and the
  reply count below. A "Skriv något till gruppen…" box sits at the top of
  every list and opens the composer in one tap.
- **"Gilla" as a word.** The heart under every post shows the word next to
  it, so every control has a visible word.
- **Google first on the login page.** The login and create-account pages
  are one card: the dansbart mark, a heading that names Google, one line of
  reassurance, a large "Logga in med Google" button, and then "eller logga
  in med e-post" above the email form.
- **A way back.** The header gets a "Till musiken" link to dansbart.se, and
  the login page a "Tillbaka till dansbart.se" link.

## Install

Discourse installs a theme from the root of a git repository, so this
directory has to be uploaded rather than linked:

```bash
make discourse-theme          # writes discourse/dansbart-theme.zip
```

Then in Discourse: **Admin → Customize → Themes → Install → From your
device**, pick the zip, and set the theme as the default. Select "Dansbart
ljus" as the colour palette and "Dansbart mörk" as the dark palette.

For iterating on the theme, the [`discourse_theme`
CLI](https://meta.discourse.org/t/82950) uploads the directory and watches
it for changes:

```bash
gem install discourse_theme
discourse_theme watch discourse/theme
```

## Site settings that the theme relies on

Set these in **Admin → Settings**:

| Setting | Value | Why |
| --- | --- | --- |
| `always include topic excerpts` | on | Without it Discourse only sends an excerpt for pinned topics, so the feed shows no first lines. |
| `post menu` | `like\|reply\|share\|bookmark\|flag\|edit\|delete\|admin` | Puts "Gilla" and "Svara" first under a post, the way a Facebook post leads with Like and Comment. |
| `enable names` and `display name on posts` | on | The feed and the posts show the person's name, not just a username. |
| `prioritize username in ux` | off | Same reason. |
| `logo` / `logo small` / `logo dark` | the files in `assets/` | The site's mark. A theme cannot set the logo itself. |

## Site texts worth overriding

In **Admin → Customize → Text** the forum's own words can be brought closer
to the group feel. Suggested Swedish overrides:

| Key | Default | Suggested |
| --- | --- | --- |
| `js.login.google_oauth2.title` | "med Google" | "Logga in med Google" |
| `js.topic.create` | "Nytt ämne" | "Nytt inlägg" |
| `js.topic.reply.title` | "Svara" | "Kommentera" |
| `js.filters.latest.title` | "Senaste" | "Senaste inläggen" |

## Theme settings

All of the behaviour above can be switched off in **Admin → Customize →
Themes → Dansbart → Settings**: the feed layout, the author line, the
composer box, the "Gilla" label, the header link, and the texts on the
login page.

## Files

```
about.json                     name, assets, the two colour schemes
settings.yml                   the switches and texts listed above
common/common.scss             tokens, controls, header, feed, posts, login
desktop/desktop.scss           widths on a desktop
mobile/mobile.scss             gutters on a phone
javascripts/discourse/
  api-initializers/            wires the components into plugin outlets
  components/                  composer prompt, feed author and excerpt,
                               login intro and separator, header link
locales/sv.yml, en.yml         the theme's own strings and setting help
assets/fonts/                  Schibsted Grotesk (SIL Open Font License)
assets/*.svg                   logo files to upload as the site logo
```

The tokens in `common/common.scss` mirror `frontend/src/index.css` and
`frontend/DESIGN.md`. When a colour or radius changes on the site, change
it here too.

## Checking a change

The theme has no automated test. To verify a change, upload it to the beta
forum with `discourse_theme watch`, then look at these pages in both
palettes and at a phone width:

1. `/latest` logged in and logged out: the composer box, the cards, the
   author lines, the excerpts.
2. A topic: the post cards, "Gilla" and "Svara" under a post.
3. `/login` and `/signup`: the intro, the Google button first, the
   separator, the email form, the focus ring on every control.
