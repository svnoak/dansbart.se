package se.dansbart.e2e.public_;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ArtistControllerE2ETest extends AbstractE2ETest {

    private Artist artistA;
    private Artist artistB;
    private Album albumX;
    private Album albumY;
    private Album albumZ;
    private Album albumW;

    @BeforeEach
    void setUp() {
        artistA = testData.artist().withName("Artist A").build();
        artistB = testData.artist().withName("Artist B").build();

        // Album X: B as primary artist, has track by A and track by B
        albumX = testData.album()
            .withTitle("Album X")
            .withReleaseDate("2025-01-15")
            .withArtist(artistB)
            .build();
        testData.addTrackToAlbum(albumX, testData.track().withTitle("Track A on X").withArtist(artistA).build());
        testData.addTrackToAlbum(albumX, testData.track().withTitle("Track B on X").withArtist(artistB).build());

        // Album Y: A as primary artist, has 2 tracks by A
        albumY = testData.album()
            .withTitle("Album Y")
            .withReleaseDate("2025-02-10")
            .withArtist(artistA)
            .build();
        testData.addTrackToAlbum(albumY, testData.track().withTitle("Track 1 on Y").withArtist(artistA).build());
        testData.addTrackToAlbum(albumY, testData.track().withTitle("Track 2 on Y").withArtist(artistA).build());

        // Album Z: A as primary artist, has no tracks, release date is null
        albumZ = testData.album()
            .withTitle("Album Z")
            .withReleaseDate(null)
            .withArtist(artistA)
            .build();

        // Album W: B as primary artist, has track by B only
        albumW = testData.album()
            .withTitle("Album W")
            .withReleaseDate("2025-03-05")
            .withArtist(artistB)
            .build();
        testData.addTrackToAlbum(albumW, testData.track().withTitle("Track B on W").withArtist(artistB).build());
    }

    @Nested
    @DisplayName("GET /api/artists/{id}/albums")
    class GetArtistAlbums {

        @Test
        @DisplayName("includes album where artist only has tracks on it")
        void getArtistAlbums_includesAlbumWhereArtistOnlyHasTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[*].id", hasItems(
                    albumX.getId().toString(),
                    albumY.getId().toString(),
                    albumZ.getId().toString()
                )))
                .andExpect(jsonPath("$[*].id", not(hasItem(albumW.getId().toString()))));
        }

        @Test
        @DisplayName("returns each album once")
        void getArtistAlbums_returnsEachAlbumOnce() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.id == '" + albumY.getId() + "')]", hasSize(1)));
        }

        @Test
        @DisplayName("orders by release date descending with nulls last")
        void getArtistAlbums_ordersByReleaseDateDescNullsLast() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].title").value("Album Y"))
                .andExpect(jsonPath("$[1].title").value("Album X"))
                .andExpect(jsonPath("$[2].title").value("Album Z"));
        }

        @Test
        @DisplayName("track count counts all album tracks")
        void getArtistAlbums_trackCountCountsAllAlbumTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.id == '" + albumX.getId() + "')].trackCount", hasItem(2)));
        }
    }

    @Nested
    @DisplayName("GET /api/artists/{id}")
    class GetArtistById {

        @Test
        @DisplayName("album count includes albums where artist only has tracks")
        void getArtistById_albumCountIncludesAlbumsWhereArtistOnlyHasTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.albumCount").value(3))
                .andExpect(jsonPath("$.albums").isArray())
                .andExpect(jsonPath("$.albums", hasSize(3)));
        }
    }
}
