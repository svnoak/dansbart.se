package se.dansbart.domain.track;

/** Ported from neckenml-analyzer's StyleClassifier._calculate_mpm
 *  (style_classifier.py). Keep the thresholds exactly in sync with the Python
 *  original — this is not the place to "improve" them. Moving this into the
 *  dance_style_config table is a reasonable later refactor. */
public final class BpmMultiplierResolver {

    private BpmMultiplierResolver() {
    }

    public record Result(float multiplier, int effectiveBpm) {
    }

    public static Result resolve(String style, Float rawBpm) {
        if (rawBpm == null || rawBpm == 0f) {
            return new Result(1.0f, 0);
        }

        float multiplier = 1.0f;

        if ("Hambo".equals(style)) {
            if (rawBpm > 160) {
                multiplier = 0.333f;
            } else if (rawBpm < 70) {
                multiplier = 2.0f;
            }
        } else if ("Polska".equals(style) || "Slängpolska".equals(style)) {
            if (rawBpm > 180) {
                multiplier = 0.5f;
            }
        } else if ("Schottis".equals(style)) {
            if (rawBpm > 200) {
                multiplier = 0.5f;
            } else if (rawBpm < 75) {
                multiplier = 2.0f;
            }
        } else if ("Vals".equals(style)) {
            if (rawBpm > 100) {
                multiplier = 0.333f;
            }
        }

        int effectiveBpm = (int) (rawBpm * multiplier);
        return new Result(multiplier, effectiveBpm);
    }
}
