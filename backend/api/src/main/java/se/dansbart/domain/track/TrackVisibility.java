package se.dansbart.domain.track;

import org.jooq.Condition;
import se.dansbart.jooq.tables.Tracks;

public class TrackVisibility {
    private static final Tracks TRACKS = Tracks.TRACKS;

    public static Condition publicOnly() {
        return TRACKS.IS_PRIVATE.isFalse();
    }
}
